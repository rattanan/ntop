import { describe, expect, it, vi } from "vitest";

import {
  AppendOnlyAuditWriter,
  AUDIT_FAILURE_POLICY,
  AuditWriteError,
  type AuditAppendStore,
} from "../../lib/audit/audit-writer";

const input = {
  actorId: "user-1",
  action: "ai.provider.update",
  targetType: "AiProviderConfiguration",
  targetId: "singleton",
  outcome: "SUCCESS" as const,
  correlationId: "request-1",
};

describe("AppendOnlyAuditWriter", () => {
  it("redacts nested secrets before appending an event", async () => {
    const append = vi.fn<AuditAppendStore["append"]>().mockResolvedValue();
    const writer = new AppendOnlyAuditWriter({
      store: { append },
      createId: () => "audit-1",
      now: () => new Date("2026-07-11T08:00:00.000Z"),
    });

    const event = await writer.append({
      ...input,
      data: {
        model: "approved-model",
        apiKey: "must-not-appear",
        nested: {
          authorization_token: "must-not-appear-either",
          timeoutMs: 30_000,
        },
        items: [{ password: "hidden" }, "safe"],
      },
    });

    expect(event).toEqual({
      ...input,
      id: "audit-1",
      recordedAt: new Date("2026-07-11T08:00:00.000Z"),
      data: {
        model: "approved-model",
        apiKey: "[REDACTED]",
        nested: {
          authorization_token: "[REDACTED]",
          timeoutMs: 30_000,
        },
        items: [{ password: "[REDACTED]" }, "safe"],
      },
    });
    expect(JSON.stringify(append.mock.calls)).not.toContain("must-not-appear");
  });

  it("passes the caller transaction to the append store", async () => {
    const append = vi.fn<AuditAppendStore<object>["append"]>().mockResolvedValue();
    const transaction = { transactionId: "tx-1" };
    const writer = new AppendOnlyAuditWriter({ store: { append } });

    const event = await writer.append(input, { transaction });

    expect(append).toHaveBeenCalledWith(event, transaction);
  });

  it("fails closed, preserves the server-side cause, and keeps the public message generic", async () => {
    const storageError = new Error("database secret details");
    const append = vi
      .fn<AuditAppendStore["append"]>()
      .mockRejectedValue(storageError);
    const writer = new AppendOnlyAuditWriter({ store: { append } });

    const error = await writer.append(input).catch(cause => cause);
    expect(error).toBeInstanceOf(AuditWriteError);
    expect(error.message).toBe("Required audit event could not be recorded.");
    expect(error.message).not.toContain("database secret details");
    expect(error.cause).toBe(storageError);
    expect(AUDIT_FAILURE_POLICY).toBe("FAIL_CLOSED");
  });
});

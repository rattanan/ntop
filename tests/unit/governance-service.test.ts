import { describe, expect, it, vi } from "vitest";

import type { AuditWriter } from "../../lib/audit/audit-writer";
import {
  AI_FEEDBACK_IS_TRAINING_CONSENT,
  AiGovernanceAccessError,
  AiGovernanceService,
  type AiGovernanceRepository,
  type AiOutputProvenance,
} from "../../lib/ai/governance-service";

type Transaction = { id: string };
const now = new Date("2026-07-11T10:00:00.000Z");
const retentionMs = 30 * 24 * 60 * 60 * 1_000;

function setup(authorized = true) {
  const transaction = { id: "tx-1" };
  const repository: AiGovernanceRepository<Transaction> = {
    transaction: vi.fn(async (work) => work(transaction)),
    createDraft: vi.fn().mockResolvedValue({ id: "output-1", status: "DRAFT" }),
    findAuthorizedOutput: vi
      .fn()
      .mockResolvedValue(authorized ? { id: "output-1", status: "DRAFT" } : null),
    appendFeedback: vi.fn().mockResolvedValue({ id: "feedback-1" }),
    markAbandoned: vi.fn().mockResolvedValue(undefined),
    purgeExpiredMetadata: vi.fn().mockResolvedValue({ purgedCount: 3 }),
  };
  const auditWriter: AuditWriter<Transaction> = {
    append: vi.fn(async (event) => ({
      ...event,
      id: "audit-1",
      recordedAt: now,
    })),
  };
  const service = new AiGovernanceService({
    repository,
    auditWriter,
    abandonedMetadataRetentionMs: retentionMs,
    maxFeedbackCharacters: 1_000,
    now: () => now,
  });
  return { service, repository, auditWriter, transaction };
}

const provenance: AiOutputProvenance = {
  jobId: "job-1",
  providerConfigurationVersionId: "provider-version-1",
  capability: "meeting-draft",
  outputSchemaVersion: "meeting-draft.v1",
  providerModel: "configured-model",
  promptTemplateVersion: "meeting-draft.prompt.v1",
  inputSourceReferences: [{ type: "Activity", id: "activity-1" }],
  validatedOutput: { meetingSummary: "Validated summary" },
  safetyResult: "PASSED",
  confidenceBand: "MEDIUM",
  latencyMs: 100,
  inputTokens: 10,
  outputTokens: 5,
  totalTokens: 15,
};

describe("AiGovernanceService", () => {
  it("stores complete provenance without raw provider fields and audits in one transaction", async () => {
    const { service, repository, auditWriter, transaction } = setup();

    await service.createDraft("user-1", provenance, "request-1");

    expect(repository.createDraft).toHaveBeenCalledWith(provenance, transaction);
    const stored = vi.mocked(repository.createDraft).mock.calls[0][0];
    expect(stored).not.toHaveProperty("rawPrompt");
    expect(stored).not.toHaveProperty("rawResponse");
    expect(auditWriter.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai.output.draft.create",
        data: expect.not.objectContaining({ validatedOutput: expect.anything() }),
      }),
      { transaction },
    );
  });

  it.each(["HELPFUL", "INCORRECT", "UNSAFE"] as const)(
    "records %s feedback without granting training consent",
    async (rating) => {
      const { service, repository } = setup();

      await service.recordFeedback(
        "user-1",
        { outputId: "output-1", rating, comment: "Feedback detail" },
        "request-2",
      );

      expect(repository.appendFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ rating }),
        expect.anything(),
      );
      expect(AI_FEEDBACK_IS_TRAINING_CONSENT).toBe(false);
    },
  );

  it("rejects secret-bearing feedback before repository access", async () => {
    const { service, repository } = setup();

    await expect(
      service.recordFeedback(
        "user-1",
        {
          outputId: "output-1",
          rating: "UNSAFE",
          comment: "api key: hidden-value",
        },
        "request-3",
      ),
    ).rejects.toMatchObject({ code: "SECRET_DETECTED" });
    expect(repository.findAuthorizedOutput).not.toHaveBeenCalled();
  });

  it("uses non-disclosing authorization behavior", async () => {
    const { service } = setup(false);

    await expect(
      service.recordFeedback(
        "other-user",
        { outputId: "output-1", rating: "HELPFUL" },
        "request-4",
      ),
    ).rejects.toBeInstanceOf(AiGovernanceAccessError);
  });

  it("clears abandoned structured output and applies configured expiry", async () => {
    const { service, repository, transaction } = setup();

    await service.abandon("user-1", "output-1", "User rejected", "request-5");

    expect(repository.markAbandoned).toHaveBeenCalledWith(
      {
        outputId: "output-1",
        reason: "User rejected",
        expiresAt: new Date("2026-08-10T10:00:00.000Z"),
        clearValidatedOutput: true,
      },
      transaction,
    );
  });

  it("purges only expired rejected/abandoned metadata outside legal hold", async () => {
    const { service, repository, auditWriter, transaction } = setup();

    await expect(service.purgeExpired("system", "purge-1")).resolves.toEqual({
      purgedCount: 3,
    });
    expect(repository.purgeExpiredMetadata).toHaveBeenCalledWith(
      {
        before: now,
        statuses: ["REJECTED", "ABANDONED"],
        legalHold: false,
      },
      transaction,
    );
    expect(auditWriter.append).toHaveBeenCalledWith(
      expect.objectContaining({ data: { purgedCount: 3 } }),
      { transaction },
    );
  });

  it("propagates audit failure so governance mutations roll back", async () => {
    const { service, auditWriter } = setup();
    vi.mocked(auditWriter.append).mockRejectedValueOnce(new Error("audit unavailable"));

    await expect(
      service.createDraft("user-1", provenance, "request-6"),
    ).rejects.toThrow("audit unavailable");
  });
});

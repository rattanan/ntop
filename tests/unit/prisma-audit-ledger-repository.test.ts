import { describe, expect, it, vi } from "vitest";

import { PrismaAuditLedgerRepository } from "../../lib/audit/prisma-audit-ledger-repository";

function transaction() {
  return {
    auditLedger: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        lastSequence: BigInt(2),
        lastHash: "a".repeat(64),
        revision: 3,
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("PrismaAuditLedgerRepository", () => {
  it("reads the singleton ledger head", async () => {
    const tx = transaction();
    const repository = new PrismaAuditLedgerRepository();

    await expect(repository.readLedger(tx as never)).resolves.toEqual({
      sequence: BigInt(2),
      hash: "a".repeat(64),
      revision: 3,
    });
    expect(tx.auditLedger.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "default" },
      select: { lastSequence: true, lastHash: true, revision: true },
    });
  });

  it("advances only when the expected revision still matches", async () => {
    const tx = transaction();
    const repository = new PrismaAuditLedgerRepository();

    await expect(
      repository.advanceLedger(
        {
          expectedRevision: 3,
          nextSequence: BigInt(3),
          nextHash: "b".repeat(64),
        },
        tx as never,
      ),
    ).resolves.toBe(true);
    expect(tx.auditLedger.updateMany).toHaveBeenCalledWith({
      where: { id: "default", revision: 3 },
      data: {
        lastSequence: BigInt(3),
        lastHash: "b".repeat(64),
        revision: { increment: 1 },
      },
    });
  });

  it("inserts an append-only persisted envelope", async () => {
    const tx = transaction();
    const repository = new PrismaAuditLedgerRepository();
    const recordedAt = new Date("2026-07-11T12:00:00.000Z");

    await repository.insertEvent(
      {
        id: "audit-1",
        sequence: BigInt(3),
        actorId: "user-1",
        action: "ai.output.draft.create",
        targetType: "AiOutput",
        targetId: "output-1",
        outcome: "SUCCESS",
        correlationId: "request-1",
        data: { capability: "meeting-draft" },
        recordedAt,
        previousHash: "a".repeat(64),
        eventHash: "b".repeat(64),
      },
      tx as never,
    );

    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sequence: BigInt(3),
          previousHash: "a".repeat(64),
          eventHash: "b".repeat(64),
          recordedAt,
        }),
      }),
    );
  });
});

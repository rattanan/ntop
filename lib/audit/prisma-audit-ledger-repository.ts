import type { Prisma } from "@prisma/client";

import type {
  AuditLedgerHead,
  HashChainedAuditRepository,
  PersistedAuditEvent,
} from "./hash-chained-audit-store";

export type PrismaAuditTransaction = Pick<
  Prisma.TransactionClient,
  "auditLedger" | "auditEvent"
>;

export class PrismaAuditLedgerRepository
  implements HashChainedAuditRepository<PrismaAuditTransaction>
{
  async readLedger(transaction: PrismaAuditTransaction): Promise<AuditLedgerHead> {
    const ledger = await transaction.auditLedger.findUniqueOrThrow({
      where: { id: "default" },
      select: { lastSequence: true, lastHash: true, revision: true },
    });
    return {
      sequence: ledger.lastSequence,
      hash: ledger.lastHash,
      revision: ledger.revision,
    };
  }

  async advanceLedger(
    input: {
      expectedRevision: number;
      nextSequence: bigint;
      nextHash: string;
    },
    transaction: PrismaAuditTransaction,
  ) {
    const result = await transaction.auditLedger.updateMany({
      where: { id: "default", revision: input.expectedRevision },
      data: {
        lastSequence: input.nextSequence,
        lastHash: input.nextHash,
        revision: { increment: 1 },
      },
    });
    return result.count === 1;
  }

  async insertEvent(
    event: PersistedAuditEvent,
    transaction: PrismaAuditTransaction,
  ) {
    await transaction.auditEvent.create({
      data: {
        id: event.id,
        sequence: event.sequence,
        actorId: event.actorId,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        targetVersion: event.targetVersion ?? null,
        outcome: event.outcome,
        correlationId: event.correlationId,
        reason: event.reason ?? null,
        data: event.data as Prisma.InputJsonValue | undefined,
        previousHash: event.previousHash,
        eventHash: event.eventHash,
        recordedAt: event.recordedAt,
      },
    });
  }
}

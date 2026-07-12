import { createHash } from "node:crypto";

import type { AuditAppendStore, AuditEvent } from "./audit-writer";

export type AuditLedgerHead = {
  sequence: bigint;
  hash: string;
  revision: number;
};

export type PersistedAuditEvent = AuditEvent & {
  sequence: bigint;
  previousHash: string;
  eventHash: string;
};

export interface HashChainedAuditRepository<TTransaction> {
  readLedger(transaction: TTransaction): Promise<AuditLedgerHead>;
  advanceLedger(
    input: {
      expectedRevision: number;
      nextSequence: bigint;
      nextHash: string;
    },
    transaction: TTransaction,
  ): Promise<boolean>;
  insertEvent(event: PersistedAuditEvent, transaction: TTransaction): Promise<void>;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function calculateAuditEventHash({
  event,
  sequence,
  previousHash,
}: {
  event: AuditEvent;
  sequence: bigint;
  previousHash: string;
}) {
  return createHash("sha256")
    .update(
      canonicalJson({
        sequence: sequence.toString(),
        previousHash,
        id: event.id,
        actorId: event.actorId,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        targetVersion: event.targetVersion ?? null,
        outcome: event.outcome,
        correlationId: event.correlationId,
        reason: event.reason ?? null,
        data: event.data ?? null,
        recordedAt: event.recordedAt.toISOString(),
      }),
    )
    .digest("hex");
}

export function verifyAuditChain(events: readonly PersistedAuditEvent[]) {
  let previousHash = "0".repeat(64);
  let previousSequence = BigInt(0);
  for (const event of events) {
    if (event.sequence !== previousSequence + BigInt(1)) return false;
    if (event.previousHash !== previousHash) return false;
    if (
      event.eventHash !==
      calculateAuditEventHash({
        event,
        sequence: event.sequence,
        previousHash: event.previousHash,
      })
    ) {
      return false;
    }
    previousSequence = event.sequence;
    previousHash = event.eventHash;
  }
  return true;
}

export class AuditLedgerContentionError extends Error {
  constructor() {
    super("Required audit event could not be recorded.");
    this.name = "AuditLedgerContentionError";
  }
}

export class HashChainedAuditStore<TTransaction>
  implements AuditAppendStore<TTransaction>
{
  private readonly repository: HashChainedAuditRepository<TTransaction>;
  private readonly maxAttempts: number;

  constructor({
    repository,
    maxAttempts,
  }: {
    repository: HashChainedAuditRepository<TTransaction>;
    maxAttempts: number;
  }) {
    this.repository = repository;
    this.maxAttempts = maxAttempts;
  }

  async append(event: AuditEvent, transaction?: TTransaction) {
    if (transaction === undefined) throw new AuditLedgerContentionError();

    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      const head = await this.repository.readLedger(transaction);
      const sequence = head.sequence + BigInt(1);
      const eventHash = calculateAuditEventHash({
        event,
        sequence,
        previousHash: head.hash,
      });
      const advanced = await this.repository.advanceLedger(
        {
          expectedRevision: head.revision,
          nextSequence: sequence,
          nextHash: eventHash,
        },
        transaction,
      );
      if (!advanced) continue;

      await this.repository.insertEvent(
        { ...event, sequence, previousHash: head.hash, eventHash },
        transaction,
      );
      return;
    }

    throw new AuditLedgerContentionError();
  }
}

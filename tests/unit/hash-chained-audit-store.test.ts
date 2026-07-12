import { describe, expect, it, vi } from "vitest";

import {
  calculateAuditEventHash,
  AuditLedgerContentionError,
  HashChainedAuditStore,
  verifyAuditChain,
  type HashChainedAuditRepository,
} from "../../lib/audit/hash-chained-audit-store";

type Transaction = { id: string };
const transaction = { id: "tx-1" };
const event = {
  id: "audit-1",
  actorId: "user-1",
  action: "ai.provider.configuration.update",
  targetType: "AiProviderConfiguration",
  targetId: "default",
  outcome: "SUCCESS" as const,
  correlationId: "request-1",
  data: { model: "approved-model", enabled: true },
  recordedAt: new Date("2026-07-11T11:00:00.000Z"),
};

function setup({ advance = true } = {}) {
  const repository: HashChainedAuditRepository<Transaction> = {
    readLedger: vi.fn().mockResolvedValue({
      sequence: BigInt(4),
      hash: "a".repeat(64),
      revision: 9,
    }),
    advanceLedger: vi.fn().mockResolvedValue(advance),
    insertEvent: vi.fn().mockResolvedValue(undefined),
  };
  return {
    store: new HashChainedAuditStore({ repository, maxAttempts: 2 }),
    repository,
  };
}

describe("HashChainedAuditStore", () => {
  it("creates a deterministic hash-chained event after advancing the ledger", async () => {
    const { store, repository } = setup();

    await store.append(event, transaction);

    expect(repository.advanceLedger).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedRevision: 9,
        nextSequence: BigInt(5),
      }),
      transaction,
    );
    expect(repository.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sequence: BigInt(5),
        previousHash: "a".repeat(64),
        eventHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
      transaction,
    );
  });

  it("uses canonical data ordering for reproducible evidence", () => {
    const left = calculateAuditEventHash({
      event,
      sequence: BigInt(5),
      previousHash: "a".repeat(64),
    });
    const right = calculateAuditEventHash({
      event: { ...event, data: { enabled: true, model: "approved-model" } },
      sequence: BigInt(5),
      previousHash: "a".repeat(64),
    });

    expect(left).toBe(right);
  });

  it("retries after ledger contention and then inserts once", async () => {
    const { store, repository } = setup();
    vi.mocked(repository.advanceLedger)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await store.append(event, transaction);

    expect(repository.readLedger).toHaveBeenCalledTimes(2);
    expect(repository.insertEvent).toHaveBeenCalledTimes(1);
  });

  it("fails closed when transaction is absent or contention remains", async () => {
    const { store } = setup({ advance: false });

    await expect(store.append(event)).rejects.toBeInstanceOf(
      AuditLedgerContentionError,
    );
    await expect(store.append(event, transaction)).rejects.toBeInstanceOf(
      AuditLedgerContentionError,
    );
  });

  it("detects sequence, chain and payload tampering", () => {
    const firstHash = calculateAuditEventHash({
      event,
      sequence: BigInt(1),
      previousHash: "0".repeat(64),
    });
    const first = {
      ...event,
      sequence: BigInt(1),
      previousHash: "0".repeat(64),
      eventHash: firstHash,
    };
    const second = {
      ...event,
      id: "audit-2",
      sequence: BigInt(2),
      previousHash: firstHash,
      eventHash: calculateAuditEventHash({
        event: { ...event, id: "audit-2" },
        sequence: BigInt(2),
        previousHash: firstHash,
      }),
    };

    expect(verifyAuditChain([first, second])).toBe(true);
    expect(
      verifyAuditChain([{ ...first, data: { model: "modified" } }, second]),
    ).toBe(false);
  });
});

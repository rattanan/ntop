import { describe, expect, it, vi } from "vitest";

import {
  AiJobExecutionError,
  AiJobQuotaError,
  AiJobRunner,
  type AiJobRecord,
  type AiJobRepository,
} from "../../lib/ai/job-runner";

const now = new Date("2026-07-11T10:00:00.000Z");
const policy = {
  maxAttempts: 3,
  maxConcurrentPerRequester: 2,
  maxQueuedPerRequester: 5,
  leaseMs: 60_000,
  retryDelayMs: [1_000, 5_000, 30_000],
};

function job(overrides: Partial<AiJobRecord> = {}): AiJobRecord {
  return {
    id: "job-1",
    idempotencyKey: "idem-1",
    capability: "meeting-draft",
    requestedById: "user-1",
    state: "QUEUED",
    attemptCount: 0,
    maxAttempts: 3,
    availableAt: now,
    leaseExpiresAt: null,
    ...overrides,
  };
}

function setup({
  existing = null,
  claimed = job({ state: "RUNNING", attemptCount: 1 }),
  counts = { running: 0, queued: 0 },
}: {
  existing?: AiJobRecord | null;
  claimed?: AiJobRecord | null;
  counts?: { running: number; queued: number };
} = {}) {
  const created = job();
  const repository: AiJobRepository = {
    findByIdempotencyKey: vi.fn().mockResolvedValue(existing),
    countByRequester: vi.fn().mockResolvedValue(counts),
    createOrGet: vi.fn().mockResolvedValue(created),
    claimNext: vi.fn().mockResolvedValue(claimed),
    markSucceeded: vi
      .fn()
      .mockImplementation(async () => job({ state: "SUCCEEDED" })),
    scheduleRetry: vi
      .fn()
      .mockImplementation(async () => job({ state: "QUEUED" })),
    markFailed: vi
      .fn()
      .mockImplementation(async () => job({ state: "FAILED" })),
    cancel: vi
      .fn()
      .mockImplementation(async () => job({ state: "CANCELLED" })),
  };
  const runner = new AiJobRunner({ repository, policy, now: () => now });

  return { runner, repository, created };
}

describe("AiJobRunner", () => {
  it("returns an existing idempotent job before quota or create", async () => {
    const existing = job({ id: "existing-job" });
    const { runner, repository } = setup({ existing });

    await expect(
      runner.enqueue({
        idempotencyKey: "idem-1",
        capability: "meeting-draft",
        requestedById: "user-1",
      }),
    ).resolves.toBe(existing);
    expect(repository.countByRequester).not.toHaveBeenCalled();
    expect(repository.createOrGet).not.toHaveBeenCalled();
  });

  it("uses configured quota and retry limits when creating", async () => {
    const { runner, repository, created } = setup();

    await expect(
      runner.enqueue({
        idempotencyKey: "idem-1",
        capability: "meeting-draft",
        requestedById: "user-1",
      }),
    ).resolves.toBe(created);
    expect(repository.createOrGet).toHaveBeenCalledWith({
      idempotencyKey: "idem-1",
      capability: "meeting-draft",
      requestedById: "user-1",
      maxAttempts: 3,
      availableAt: now,
    });

    const quotaSetup = setup({ counts: { running: 2, queued: 0 } });
    await expect(
      quotaSetup.runner.enqueue({
        idempotencyKey: "new-idem",
        capability: "meeting-draft",
        requestedById: "user-1",
      }),
    ).rejects.toBeInstanceOf(AiJobQuotaError);
  });

  it("claims with a bounded lease and succeeds once", async () => {
    const { runner, repository } = setup();
    const execute = vi.fn().mockResolvedValue(undefined);

    await expect(runner.runNext({ workerId: "worker-1", execute })).resolves.toMatchObject({
      state: "SUCCEEDED",
    });
    expect(repository.claimNext).toHaveBeenCalledWith({
      workerId: "worker-1",
      now,
      leaseExpiresAt: new Date("2026-07-11T10:01:00.000Z"),
      reclaimExpiredLeases: true,
    });
    expect(execute).toHaveBeenCalledOnce();
    expect(repository.markSucceeded).toHaveBeenCalledOnce();
  });

  it("retries transient timeout with configured backoff", async () => {
    const { runner, repository } = setup({
      claimed: job({ state: "RUNNING", attemptCount: 2 }),
    });

    await runner.runNext({
      workerId: "worker-1",
      execute: async () => {
        throw new AiJobExecutionError("TIMEOUT", true);
      },
    });

    expect(repository.scheduleRetry).toHaveBeenCalledWith({
      jobId: "job-1",
      errorCode: "TIMEOUT",
      availableAt: new Date("2026-07-11T10:00:05.000Z"),
    });
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("never retries safety errors or exhausted jobs", async () => {
    const safety = setup();
    await safety.runner.runNext({
      workerId: "worker-1",
      execute: async () => {
        throw new AiJobExecutionError("SAFETY_REJECTED", false);
      },
    });
    expect(safety.repository.scheduleRetry).not.toHaveBeenCalled();
    expect(safety.repository.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "SAFETY_REJECTED" }),
    );

    const exhausted = setup({
      claimed: job({ state: "RUNNING", attemptCount: 3, maxAttempts: 3 }),
    });
    await exhausted.runner.runNext({
      workerId: "worker-1",
      execute: async () => {
        throw new AiJobExecutionError("TIMEOUT", true);
      },
    });
    expect(exhausted.repository.scheduleRetry).not.toHaveBeenCalled();
    expect(exhausted.repository.markFailed).toHaveBeenCalledOnce();
  });

  it("delegates idempotent authorized cancellation to the repository", async () => {
    const { runner, repository } = setup();

    await runner.cancel("job-1", "user-1");
    await runner.cancel("job-1", "user-1");

    expect(repository.cancel).toHaveBeenNthCalledWith(1, {
      jobId: "job-1",
      requestedById: "user-1",
      cancelledAt: now,
    });
    expect(repository.cancel).toHaveBeenCalledTimes(2);
  });
});

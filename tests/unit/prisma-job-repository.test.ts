import { describe, expect, it, vi } from "vitest";

import { PrismaAiJobRepository } from "../../lib/ai/prisma-job-repository";

const now = new Date("2026-07-12T03:00:00.000Z");
const row = {
  id: "job-1",
  idempotencyKey: "idem-1",
  capability: "meeting-draft",
  requestedById: "user-1",
  status: "QUEUED" as const,
  attemptCount: 0,
  maxAttempts: 3,
  availableAt: now,
  leaseExpiresAt: null,
  createdAt: now,
  updatedAt: now,
};

describe("PrismaAiJobRepository", () => {
  it("atomically claims one available job with an optimistic row guard", async () => {
    const transaction = {
      aiJob: {
        findFirst: vi.fn().mockResolvedValue(row),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...row,
          status: "RUNNING",
          attemptCount: 1,
          leaseExpiresAt: new Date("2026-07-12T03:01:00.000Z"),
        }),
      },
    };
    const client = {
      $transaction: vi.fn(async (work) => work(transaction)),
    };
    const repository = new PrismaAiJobRepository(client as never);

    await expect(
      repository.claimNext({
        workerId: "worker-1",
        now,
        leaseExpiresAt: new Date("2026-07-12T03:01:00.000Z"),
        reclaimExpiredLeases: true,
      }),
    ).resolves.toMatchObject({ state: "RUNNING", attemptCount: 1 });
    expect(transaction.aiJob.updateMany).toHaveBeenCalledWith({
      where: { id: "job-1", status: "QUEUED", updatedAt: now },
      data: expect.objectContaining({
        status: "RUNNING",
        attemptCount: { increment: 1 },
      }),
    });
  });

  it("returns null when another worker wins the claim", async () => {
    const transaction = {
      aiJob: {
        findFirst: vi.fn().mockResolvedValue(row),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const repository = new PrismaAiJobRepository({
      $transaction: vi.fn(async (work) => work(transaction)),
    } as never);

    await expect(
      repository.claimNext({
        workerId: "worker-2",
        now,
        leaseExpiresAt: new Date("2026-07-12T03:01:00.000Z"),
        reclaimExpiredLeases: true,
      }),
    ).resolves.toBeNull();
  });

  it("scopes cancellation to the requesting user", async () => {
    const transaction = {
      aiJob: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: vi.fn().mockResolvedValue({
          ...row,
          status: "CANCELLED",
        }),
      },
    };
    const repository = new PrismaAiJobRepository({
      $transaction: vi.fn(async (work) => work(transaction)),
    } as never);

    await repository.cancel({
      jobId: "job-1",
      requestedById: "user-1",
      cancelledAt: now,
    });
    expect(transaction.aiJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ requestedById: "user-1" }),
      }),
    );
  });
});

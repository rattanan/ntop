import { AiJobStatus, Prisma, PrismaClient } from "@prisma/client";

import type { AiJobRecord, AiJobRepository } from "./job-runner";

type JobRow = {
  id: string;
  idempotencyKey: string;
  capability: string;
  requestedById: string;
  status: AiJobStatus;
  attemptCount: number;
  maxAttempts: number;
  availableAt: Date;
  leaseExpiresAt: Date | null;
};

function toRecord(row: JobRow): AiJobRecord {
  return { ...row, state: row.status };
}

export class PrismaAiJobRepository implements AiJobRepository {
  constructor(private readonly client: PrismaClient) {}

  async findByIdempotencyKey(key: string) {
    const row = await this.client.aiJob.findUnique({
      where: { idempotencyKey: key },
    });
    return row ? toRecord(row) : null;
  }

  async countByRequester(requestedById: string) {
    const [running, queued] = await Promise.all([
      this.client.aiJob.count({ where: { requestedById, status: "RUNNING" } }),
      this.client.aiJob.count({ where: { requestedById, status: "QUEUED" } }),
    ]);
    return { running, queued };
  }

  async createOrGet(input: {
    idempotencyKey: string;
    capability: string;
    requestedById: string;
    maxAttempts: number;
    availableAt: Date;
  }) {
    try {
      return toRecord(
        await this.client.aiJob.create({
          data: input,
        }),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await this.client.aiJob.findUniqueOrThrow({
          where: { idempotencyKey: input.idempotencyKey },
        });
        return toRecord(existing);
      }
      throw error;
    }
  }

  claimNext(input: {
    workerId: string;
    now: Date;
    leaseExpiresAt: Date;
    reclaimExpiredLeases: true;
  }) {
    return this.client.$transaction(async (transaction) => {
      const candidate = await transaction.aiJob.findFirst({
        where: {
          OR: [
            { status: "QUEUED", availableAt: { lte: input.now } },
            { status: "RUNNING", leaseExpiresAt: { lt: input.now } },
          ],
        },
        orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
      });
      if (!candidate) return null;
      const claimed = await transaction.aiJob.updateMany({
        where: {
          id: candidate.id,
          status: candidate.status,
          updatedAt: candidate.updatedAt,
        },
        data: {
          status: "RUNNING",
          attemptCount: { increment: 1 },
          leaseExpiresAt: input.leaseExpiresAt,
          startedAt: input.now,
          errorCode: null,
        },
      });
      if (claimed.count !== 1) return null;
      return toRecord(
        await transaction.aiJob.findUniqueOrThrow({
          where: { id: candidate.id },
        }),
      );
    });
  }

  async markSucceeded(jobId: string, completedAt: Date) {
    return toRecord(
      await this.client.aiJob.update({
        where: { id: jobId },
        data: {
          status: "SUCCEEDED",
          completedAt,
          leaseExpiresAt: null,
          errorCode: null,
        },
      }),
    );
  }

  async scheduleRetry(input: {
    jobId: string;
    errorCode: string;
    availableAt: Date;
  }) {
    return toRecord(
      await this.client.aiJob.update({
        where: { id: input.jobId },
        data: {
          status: "QUEUED",
          errorCode: input.errorCode,
          availableAt: input.availableAt,
          leaseExpiresAt: null,
        },
      }),
    );
  }

  async markFailed(input: {
    jobId: string;
    errorCode: string;
    completedAt: Date;
  }) {
    return toRecord(
      await this.client.aiJob.update({
        where: { id: input.jobId },
        data: {
          status: "FAILED",
          errorCode: input.errorCode,
          completedAt: input.completedAt,
          leaseExpiresAt: null,
        },
      }),
    );
  }

  cancel(input: {
    jobId: string;
    requestedById: string;
    cancelledAt: Date;
  }) {
    return this.client.$transaction(async (transaction) => {
      await transaction.aiJob.updateMany({
        where: {
          id: input.jobId,
          requestedById: input.requestedById,
          status: { in: ["QUEUED", "RUNNING"] },
        },
        data: {
          status: "CANCELLED",
          completedAt: input.cancelledAt,
          leaseExpiresAt: null,
        },
      });
      const job = await transaction.aiJob.findFirstOrThrow({
        where: { id: input.jobId, requestedById: input.requestedById },
      });
      return toRecord(job);
    });
  }
}

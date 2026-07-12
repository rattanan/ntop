export type AiJobState =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export type AiJobRecord = {
  id: string;
  idempotencyKey: string;
  capability: string;
  requestedById: string;
  state: AiJobState;
  attemptCount: number;
  maxAttempts: number;
  availableAt: Date;
  leaseExpiresAt: Date | null;
};

export type AiJobRunnerPolicy = {
  maxAttempts: number;
  maxConcurrentPerRequester: number;
  maxQueuedPerRequester: number;
  leaseMs: number;
  retryDelayMs: readonly number[];
};

export interface AiJobRepository {
  findByIdempotencyKey(key: string): Promise<AiJobRecord | null>;
  countByRequester(
    requestedById: string,
  ): Promise<{ running: number; queued: number }>;
  createOrGet(input: {
    idempotencyKey: string;
    capability: string;
    requestedById: string;
    maxAttempts: number;
    availableAt: Date;
  }): Promise<AiJobRecord>;
  claimNext(input: {
    workerId: string;
    now: Date;
    leaseExpiresAt: Date;
    reclaimExpiredLeases: true;
  }): Promise<AiJobRecord | null>;
  markSucceeded(jobId: string, completedAt: Date): Promise<AiJobRecord>;
  scheduleRetry(input: {
    jobId: string;
    errorCode: string;
    availableAt: Date;
  }): Promise<AiJobRecord>;
  markFailed(input: {
    jobId: string;
    errorCode: string;
    completedAt: Date;
  }): Promise<AiJobRecord>;
  cancel(input: {
    jobId: string;
    requestedById: string;
    cancelledAt: Date;
  }): Promise<AiJobRecord>;
}

export class AiJobQuotaError extends Error {
  constructor() {
    super("AI job quota is currently exceeded.");
    this.name = "AiJobQuotaError";
  }
}

export class AiJobExecutionError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, retryable: boolean) {
    super("AI job execution failed.");
    this.name = "AiJobExecutionError";
    this.code = code;
    this.retryable = retryable;
  }
}

export class AiJobRunner {
  private readonly repository: AiJobRepository;
  private readonly policy: AiJobRunnerPolicy;
  private readonly now: () => Date;

  constructor({
    repository,
    policy,
    now = () => new Date(),
  }: {
    repository: AiJobRepository;
    policy: AiJobRunnerPolicy;
    now?: () => Date;
  }) {
    this.repository = repository;
    this.policy = policy;
    this.now = now;
  }

  async enqueue(input: {
    idempotencyKey: string;
    capability: string;
    requestedById: string;
  }) {
    const existing = await this.repository.findByIdempotencyKey(
      input.idempotencyKey,
    );
    if (existing) return existing;

    const counts = await this.repository.countByRequester(input.requestedById);
    if (
      counts.running >= this.policy.maxConcurrentPerRequester ||
      counts.queued >= this.policy.maxQueuedPerRequester
    ) {
      throw new AiJobQuotaError();
    }

    return this.repository.createOrGet({
      ...input,
      maxAttempts: this.policy.maxAttempts,
      availableAt: this.now(),
    });
  }

  async runNext({
    workerId,
    execute,
  }: {
    workerId: string;
    execute: (job: AiJobRecord) => Promise<void>;
  }) {
    const claimedAt = this.now();
    const job = await this.repository.claimNext({
      workerId,
      now: claimedAt,
      leaseExpiresAt: new Date(claimedAt.getTime() + this.policy.leaseMs),
      reclaimExpiredLeases: true,
    });
    if (!job) return null;

    try {
      await execute(job);
      return this.repository.markSucceeded(job.id, this.now());
    } catch (error) {
      const executionError =
        error instanceof AiJobExecutionError
          ? error
          : new AiJobExecutionError("UNEXPECTED", false);
      const hasAttemptsRemaining = job.attemptCount < job.maxAttempts;

      if (executionError.retryable && hasAttemptsRemaining) {
        const delayIndex = Math.min(
          Math.max(job.attemptCount - 1, 0),
          this.policy.retryDelayMs.length - 1,
        );
        const delayMs = this.policy.retryDelayMs[delayIndex];
        return this.repository.scheduleRetry({
          jobId: job.id,
          errorCode: executionError.code,
          availableAt: new Date(this.now().getTime() + delayMs),
        });
      }

      return this.repository.markFailed({
        jobId: job.id,
        errorCode: executionError.code,
        completedAt: this.now(),
      });
    }
  }

  cancel(jobId: string, requestedById: string) {
    return this.repository.cancel({
      jobId,
      requestedById,
      cancelledAt: this.now(),
    });
  }
}

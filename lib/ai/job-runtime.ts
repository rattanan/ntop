import { z } from "zod";

import { prisma } from "../prisma";
import { AiJobRunner, type AiJobRunnerPolicy } from "./job-runner";
import { PrismaAiJobRepository } from "./prisma-job-repository";

const positiveInteger = z.coerce.number().int().positive();

export class AiJobConfigurationError extends Error {
  constructor() {
    super("AI job policy configuration is invalid.");
    this.name = "AiJobConfigurationError";
  }
}

export function loadAiJobPolicy(
  environment: Record<string, string | undefined> = process.env,
): AiJobRunnerPolicy {
  const retryDelayMs = (environment.AI_JOB_RETRY_DELAY_MS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map(Number);
  const parsed = z
    .object({
      maxAttempts: positiveInteger,
      maxConcurrentPerRequester: positiveInteger,
      maxQueuedPerRequester: positiveInteger,
      leaseMs: positiveInteger,
      retryDelayMs: z.array(z.number().int().positive()).min(1),
    })
    .safeParse({
      maxAttempts: environment.AI_JOB_MAX_ATTEMPTS,
      maxConcurrentPerRequester:
        environment.AI_JOB_MAX_CONCURRENT_PER_REQUESTER,
      maxQueuedPerRequester: environment.AI_JOB_MAX_QUEUED_PER_REQUESTER,
      leaseMs: environment.AI_JOB_LEASE_MS,
      retryDelayMs,
    });
  if (!parsed.success) throw new AiJobConfigurationError();
  return parsed.data;
}

export function createAiJobRuntime() {
  return new AiJobRunner({
    repository: new PrismaAiJobRepository(prisma),
    policy: loadAiJobPolicy(),
  });
}

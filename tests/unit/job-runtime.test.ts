import { describe, expect, it } from "vitest";

import {
  AiJobConfigurationError,
  loadAiJobPolicy,
} from "../../lib/ai/job-runtime";

const valid = {
  AI_JOB_MAX_ATTEMPTS: "3",
  AI_JOB_MAX_CONCURRENT_PER_REQUESTER: "2",
  AI_JOB_MAX_QUEUED_PER_REQUESTER: "5",
  AI_JOB_LEASE_MS: "60000",
  AI_JOB_RETRY_DELAY_MS: "1000,5000,30000",
};

describe("AI job runtime policy", () => {
  it("loads all quota, lease and retry values from configuration", () => {
    expect(loadAiJobPolicy(valid)).toEqual({
      maxAttempts: 3,
      maxConcurrentPerRequester: 2,
      maxQueuedPerRequester: 5,
      leaseMs: 60_000,
      retryDelayMs: [1_000, 5_000, 30_000],
    });
  });

  it.each([
    { ...valid, AI_JOB_MAX_ATTEMPTS: "0" },
    { ...valid, AI_JOB_LEASE_MS: "invalid" },
    { ...valid, AI_JOB_RETRY_DELAY_MS: "" },
  ])("fails closed for invalid policy", (environment) => {
    expect(() => loadAiJobPolicy(environment)).toThrow(
      AiJobConfigurationError,
    );
  });
});

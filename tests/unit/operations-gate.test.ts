import { describe, expect, it, vi } from "vitest";

import {
  AiOperationsGate,
  type AiCapabilityConfigurationProvider,
  type AiCircuitBreaker,
  type AiTelemetrySink,
} from "../../lib/ai/operations-gate";

function setup({ enabled = true, circuitAllows = true } = {}) {
  const configuration: AiCapabilityConfigurationProvider = {
    get: vi.fn().mockResolvedValue({ enabled }),
  };
  const circuitBreaker: AiCircuitBreaker = {
    allows: vi.fn().mockResolvedValue(circuitAllows),
    recordSuccess: vi.fn().mockResolvedValue(undefined),
    recordFailure: vi.fn().mockResolvedValue(undefined),
  };
  const telemetry: AiTelemetrySink = {
    record: vi.fn().mockResolvedValue(undefined),
  };
  const clock = [1_000, 1_025];
  const gate = new AiOperationsGate({
    configuration,
    circuitBreaker,
    telemetry,
    nowMs: () => clock.shift() ?? 1_025,
  });
  return { gate, configuration, circuitBreaker, telemetry };
}

describe("AiOperationsGate", () => {
  it("does not call the provider when a capability is disabled", async () => {
    const { gate, circuitBreaker, telemetry } = setup({ enabled: false });
    const run = vi.fn().mockResolvedValue({ value: "not-called" });

    await expect(
      gate.execute({ capability: "meeting-draft", run }),
    ).resolves.toEqual({ available: false, reason: "DISABLED" });
    expect(run).not.toHaveBeenCalled();
    expect(circuitBreaker.allows).not.toHaveBeenCalled();
    expect(telemetry.record).toHaveBeenCalledWith({
      capability: "meeting-draft",
      outcome: "DISABLED",
      latencyMs: 25,
      queueAgeMs: undefined,
    });
  });

  it("does not call the provider while the circuit is open", async () => {
    const { gate, telemetry } = setup({ circuitAllows: false });
    const run = vi.fn().mockResolvedValue({ value: "not-called" });

    await expect(
      gate.execute({ capability: "meeting-draft", run }),
    ).resolves.toEqual({ available: false, reason: "CIRCUIT_OPEN" });
    expect(run).not.toHaveBeenCalled();
    expect(telemetry.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "CIRCUIT_OPEN" }),
    );
  });

  it("records operational metrics without prompt or response content", async () => {
    const { gate, circuitBreaker, telemetry } = setup();

    await expect(
      gate.execute({
        capability: "meeting-draft",
        queueAgeMs: 40,
        run: async () => ({
          value: "private model response",
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        }),
      }),
    ).resolves.toEqual({ available: true, value: "private model response" });
    expect(circuitBreaker.recordSuccess).toHaveBeenCalledWith(
      "meeting-draft",
    );
    const event = vi.mocked(telemetry.record).mock.calls[0][0];
    expect(event).toMatchObject({
      capability: "meeting-draft",
      outcome: "SUCCESS",
      latencyMs: 25,
      queueAgeMs: 40,
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    });
    expect(event).not.toHaveProperty("prompt");
    expect(event).not.toHaveProperty("response");
  });

  it("degrades provider errors to manual-flow availability", async () => {
    const { gate, circuitBreaker, telemetry } = setup();

    await expect(
      gate.execute({
        capability: "meeting-draft",
        run: async () => {
          throw Object.assign(new Error("raw provider diagnostics"), {
            code: "TIMEOUT",
          });
        },
      }),
    ).resolves.toEqual({
      available: false,
      reason: "PROVIDER_UNAVAILABLE",
    });
    expect(circuitBreaker.recordFailure).toHaveBeenCalledWith(
      "meeting-draft",
    );
    const event = vi.mocked(telemetry.record).mock.calls[0][0];
    expect(event).toMatchObject({ outcome: "ERROR", errorCode: "TIMEOUT" });
    expect(JSON.stringify(event)).not.toContain("raw provider diagnostics");
  });
});

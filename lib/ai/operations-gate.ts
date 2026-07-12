export type AiCapabilityOperationsConfiguration = {
  enabled: boolean;
};

export interface AiCapabilityConfigurationProvider {
  get(capability: string): Promise<AiCapabilityOperationsConfiguration>;
}

export interface AiCircuitBreaker {
  allows(capability: string): Promise<boolean>;
  recordSuccess(capability: string): Promise<void>;
  recordFailure(capability: string): Promise<void>;
}

export type AiTelemetryEvent = {
  capability: string;
  outcome: "SUCCESS" | "DISABLED" | "CIRCUIT_OPEN" | "ERROR";
  latencyMs: number;
  queueAgeMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  errorCode?: string;
};

export interface AiTelemetrySink {
  record(event: AiTelemetryEvent): Promise<void>;
}

export type AiOperationResult<T> =
  | { available: true; value: T }
  | {
      available: false;
      reason: "DISABLED" | "CIRCUIT_OPEN" | "PROVIDER_UNAVAILABLE";
    };

export class AiOperationsGate {
  private readonly configuration: AiCapabilityConfigurationProvider;
  private readonly circuitBreaker: AiCircuitBreaker;
  private readonly telemetry: AiTelemetrySink;
  private readonly nowMs: () => number;

  constructor({
    configuration,
    circuitBreaker,
    telemetry,
    nowMs = Date.now,
  }: {
    configuration: AiCapabilityConfigurationProvider;
    circuitBreaker: AiCircuitBreaker;
    telemetry: AiTelemetrySink;
    nowMs?: () => number;
  }) {
    this.configuration = configuration;
    this.circuitBreaker = circuitBreaker;
    this.telemetry = telemetry;
    this.nowMs = nowMs;
  }

  async execute<T>({
    capability,
    queueAgeMs,
    run,
  }: {
    capability: string;
    queueAgeMs?: number;
    run: () => Promise<{
      value: T;
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
      };
    }>;
  }): Promise<AiOperationResult<T>> {
    const startedAt = this.nowMs();
    const configuration = await this.configuration.get(capability);
    if (!configuration.enabled) {
      await this.telemetry.record({
        capability,
        outcome: "DISABLED",
        latencyMs: this.nowMs() - startedAt,
        queueAgeMs,
      });
      return { available: false, reason: "DISABLED" };
    }

    if (!(await this.circuitBreaker.allows(capability))) {
      await this.telemetry.record({
        capability,
        outcome: "CIRCUIT_OPEN",
        latencyMs: this.nowMs() - startedAt,
        queueAgeMs,
      });
      return { available: false, reason: "CIRCUIT_OPEN" };
    }

    try {
      const result = await run();
      await this.circuitBreaker.recordSuccess(capability);
      await this.telemetry.record({
        capability,
        outcome: "SUCCESS",
        latencyMs: this.nowMs() - startedAt,
        queueAgeMs,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
        totalTokens: result.usage?.totalTokens,
      });
      return { available: true, value: result.value };
    } catch (error) {
      await this.circuitBreaker.recordFailure(capability);
      await this.telemetry.record({
        capability,
        outcome: "ERROR",
        latencyMs: this.nowMs() - startedAt,
        queueAgeMs,
        errorCode:
          error !== null &&
          typeof error === "object" &&
          "code" in error &&
          typeof error.code === "string"
            ? error.code
            : "UNAVAILABLE",
      });
      return { available: false, reason: "PROVIDER_UNAVAILABLE" };
    }
  }
}

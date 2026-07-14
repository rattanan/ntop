import { Prisma, type Role } from "@prisma/client";

import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import { prisma } from "../prisma";
import {
  DEAL_RISK_EXPLANATION_CAPABILITY,
  DEAL_RISK_EXPLANATION_OUTPUT_SCHEMA,
  DEAL_RISK_EXPLANATION_PROMPT_VERSION,
  DealRiskExplanationService,
} from "./deal-risk-explanation-service";
import { OpenAiCompatibleClient } from "./openai-compatible-client";
import { AiOperationsGate } from "./operations-gate";
import {
  decodeProviderMasterKey,
  decryptProviderKey,
} from "./provider-key-crypto";
import { PrismaProviderConfigurationRepository } from "./prisma-provider-configuration-repository";

export class DealRiskExplanationUnavailableError extends Error {
  constructor() {
    super("Deal Risk explanation is unavailable.");
    this.name = "DealRiskExplanationUnavailableError";
  }
}

type CircuitState = { failures: number; openUntil: number };
const circuit: CircuitState = { failures: 0, openUntil: 0 };

function enabled() {
  return process.env.AI_DEAL_RISK_EXPLANATION_ENABLED === "true";
}

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function operationsGate() {
  const threshold = positiveNumber(
    process.env.AI_DEAL_RISK_CIRCUIT_FAILURE_THRESHOLD,
    3,
  );
  const cooldownMs = positiveNumber(
    process.env.AI_DEAL_RISK_CIRCUIT_COOLDOWN_MS,
    60_000,
  );
  return new AiOperationsGate({
    configuration: {
      get: async (capability) => ({
        enabled:
          capability === DEAL_RISK_EXPLANATION_CAPABILITY && enabled(),
      }),
    },
    circuitBreaker: {
      allows: async () => circuit.openUntil <= Date.now(),
      recordSuccess: async () => {
        circuit.failures = 0;
        circuit.openUntil = 0;
      },
      recordFailure: async () => {
        circuit.failures += 1;
        if (circuit.failures >= threshold) {
          circuit.openUntil = Date.now() + cooldownMs;
        }
      },
    },
    telemetry: { record: async () => undefined },
  });
}

function auditWriter() {
  return new AppendOnlyAuditWriter<Prisma.TransactionClient>({
    store: new HashChainedAuditStore({
      repository: new PrismaAuditLedgerRepository(),
      maxAttempts: 3,
    }),
  });
}

async function providerClient() {
  const encodedMasterKey = process.env.AI_CONFIG_MASTER_KEY;
  if (!encodedMasterKey) throw new DealRiskExplanationUnavailableError();
  const configuration =
    await new PrismaProviderConfigurationRepository(
      prisma,
    ).getActiveSecretConfiguration();
  if (
    !configuration?.enabled ||
    !configuration.apiKeyCiphertext ||
    !configuration.apiKeyNonce ||
    !configuration.apiKeyAuthTag
  ) {
    throw new DealRiskExplanationUnavailableError();
  }
  try {
    const apiKey = decryptProviderKey(
      {
        ciphertext: configuration.apiKeyCiphertext,
        nonce: configuration.apiKeyNonce,
        authTag: configuration.apiKeyAuthTag,
      },
      decodeProviderMasterKey(encodedMasterKey),
    );
    return {
      configuration,
      client: new OpenAiCompatibleClient({
        apiUrl: configuration.apiUrl,
        apiKey,
        model: configuration.model,
        timeoutMs: configuration.requestTimeoutMs,
      }),
    };
  } catch {
    throw new DealRiskExplanationUnavailableError();
  }
}

export async function generateDealRiskExplanation({
  actor,
  signalId,
  idempotencyKey,
  correlationId,
}: {
  actor: { id: string; role: Role };
  signalId: string;
  idempotencyKey: string;
  correlationId: string;
}) {
  if (!enabled() || !idempotencyKey) {
    throw new DealRiskExplanationUnavailableError();
  }
  const signal = await prisma.dealRiskSignal.findFirst({
    where: {
      id: signalId,
      opportunity:
        actor.role === "ADMIN" ? {} : { ownerId: actor.id },
    },
    include: {
      opportunity: { select: { id: true, customerId: true } },
      ruleVersion: { include: { rule: { select: { code: true } } } },
    },
  });
  if (!signal) throw new DealRiskExplanationUnavailableError();

  const existing = await prisma.aiJob.findUnique({
    where: { idempotencyKey },
    include: { output: { select: { id: true } } },
  });
  if (
    existing &&
    (existing.requestedById !== actor.id ||
      existing.capability !== DEAL_RISK_EXPLANATION_CAPABILITY)
  ) {
    throw new DealRiskExplanationUnavailableError();
  }
  if (existing?.output) {
    return { outputId: existing.output.id, available: true as const };
  }

  const { configuration, client } = await providerClient();
  const job = await prisma.aiJob.upsert({
    where: { idempotencyKey },
    create: {
      idempotencyKey,
      capability: DEAL_RISK_EXPLANATION_CAPABILITY,
      requestedById: actor.id,
      status: "RUNNING",
      attemptCount: 1,
      maxAttempts: 1,
      startedAt: new Date(),
    },
    update: {},
    include: { output: { select: { id: true } } },
  });
  if (
    job.requestedById !== actor.id ||
    job.capability !== DEAL_RISK_EXPLANATION_CAPABILITY
  ) {
    throw new DealRiskExplanationUnavailableError();
  }
  if (job.output) {
    return { outputId: job.output.id, available: true as const };
  }
  const service = new DealRiskExplanationService(client, operationsGate());
  const result = await service.generate({
    riskType: signal.riskType,
    ruleCode: signal.ruleVersion.rule.code,
    ruleVersion: signal.ruleVersion.version,
    thresholdSnapshot: signal.thresholdSnapshot as Record<string, unknown>,
    triggeringFacts: signal.triggeringFacts as Record<string, unknown>,
    severitySnapshot: signal.severitySnapshot as Record<string, unknown>,
  });
  if (!result.available) {
    await prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorCode: result.reason,
        completedAt: new Date(),
      },
    });
    throw new DealRiskExplanationUnavailableError();
  }

  const completedAt = new Date();
  const output = await prisma.$transaction(async (transaction) => {
    const created = await transaction.aiOutput.create({
      data: {
        jobId: job.id,
        providerConfigurationVersionId: configuration.id,
        capability: DEAL_RISK_EXPLANATION_CAPABILITY,
        outputSchemaVersion: DEAL_RISK_EXPLANATION_OUTPUT_SCHEMA,
        providerModel: configuration.model,
        promptTemplateVersion: DEAL_RISK_EXPLANATION_PROMPT_VERSION,
        inputSourceReferences: [
          { type: "DEAL_RISK_SIGNAL", id: signal.id },
          { type: "OPPORTUNITY", id: signal.opportunity.id },
        ],
        validatedOutput: result.value,
        safetyResult: "PASSED",
        confidenceBand: "UNKNOWN",
      },
      select: { id: true },
    });
    await transaction.aiJob.update({
      where: { id: job.id },
      data: { status: "SUCCEEDED", completedAt },
    });
    await auditWriter().append(
      {
        actorId: actor.id,
        action: "deal-risk.explanation.create",
        targetType: "AiOutput",
        targetId: created.id,
        outcome: "SUCCESS",
        correlationId,
        data: {
          signalId: signal.id,
          opportunityId: signal.opportunity.id,
          ruleVersionId: signal.ruleVersionId,
        },
      },
      { transaction },
    );
    return created;
  });
  return { outputId: output.id, available: true as const };
}

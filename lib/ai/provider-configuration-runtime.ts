import { Prisma } from "@prisma/client";

import { AppendOnlyAuditWriter } from "../audit/audit-writer";
import { HashChainedAuditStore } from "../audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../audit/prisma-audit-ledger-repository";
import { prisma } from "../prisma";
import {
  decodeProviderMasterKey,
  decryptProviderKey,
  ProviderKeyCryptoError,
} from "./provider-key-crypto";
import { ProviderConfigurationService } from "./provider-config-service";
import { OpenAiCompatibleClient } from "./openai-compatible-client";
import { PrismaProviderConfigurationRepository } from "./prisma-provider-configuration-repository";

export class AiConfigurationRuntimeError extends Error {
  constructor() {
    super("AI provider configuration is unavailable.");
    this.name = "AiConfigurationRuntimeError";
  }
}

function masterKeyFromEnvironment() {
  const encoded = process.env.AI_CONFIG_MASTER_KEY;
  if (!encoded) throw new AiConfigurationRuntimeError();
  try {
    return decodeProviderMasterKey(encoded);
  } catch (error) {
    if (error instanceof ProviderKeyCryptoError) {
      throw new AiConfigurationRuntimeError();
    }
    throw error;
  }
}

export function createProviderConfigurationRuntime() {
  const repository = new PrismaProviderConfigurationRepository(prisma);
  const auditWriter = new AppendOnlyAuditWriter<Prisma.TransactionClient>({
    store: new HashChainedAuditStore({
      repository: new PrismaAuditLedgerRepository(),
      maxAttempts: 3,
    }),
  });
  return {
    repository,
    service: new ProviderConfigurationService({
      repository,
      auditWriter,
      masterKey: masterKeyFromEnvironment(),
    }),
  };
}

export async function testActiveProviderConnection(
  actorId: string,
  correlationId: string,
) {
  const { repository } = createProviderConfigurationRuntime();
  const configuration = await repository.getActiveSecretConfiguration();
  if (
    !configuration?.enabled ||
    !configuration.apiKeyCiphertext ||
    !configuration.apiKeyNonce ||
    !configuration.apiKeyAuthTag
  ) {
    throw new AiConfigurationRuntimeError();
  }
  let apiKey: string;
  try {
    apiKey = decryptProviderKey(
      {
        ciphertext: configuration.apiKeyCiphertext,
        nonce: configuration.apiKeyNonce,
        authTag: configuration.apiKeyAuthTag,
      },
      masterKeyFromEnvironment(),
    );
  } catch {
    throw new AiConfigurationRuntimeError();
  }
  const result = await new OpenAiCompatibleClient({
    apiUrl: configuration.apiUrl,
    apiKey,
    model: configuration.model,
    timeoutMs: configuration.requestTimeoutMs,
  }).testConnection();
  await repository.transaction(async (transaction) => {
    const auditWriter = new AppendOnlyAuditWriter<Prisma.TransactionClient>({
      store: new HashChainedAuditStore({
        repository: new PrismaAuditLedgerRepository(),
        maxAttempts: 3,
      }),
    });
    await auditWriter.append(
      {
        actorId,
        action: "ai.provider.connection.test",
        targetType: "AiProviderConfiguration",
        targetId: "default",
        outcome: result.ok ? "SUCCESS" : "FAILURE",
        correlationId,
        data: result.ok ? { result: "SUCCESS" } : { code: result.code },
      },
      { transaction },
    );
  });
  return result;
}

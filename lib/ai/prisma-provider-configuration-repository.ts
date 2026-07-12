import { Prisma, PrismaClient } from "@prisma/client";

import type {
  ProviderConfigurationRepository,
  ProviderConfigurationVersion,
} from "./provider-config-service";

type ProviderConfigurationTransaction = Prisma.TransactionClient;

function toVersion(record: {
  id: string;
  version: number;
  enabled: boolean;
  apiUrl: string;
  model: string;
  requestTimeoutMs: number;
  apiKeyCiphertext: Uint8Array | null;
  apiKeyNonce: Uint8Array | null;
  apiKeyAuthTag: Uint8Array | null;
}): ProviderConfigurationVersion {
  return {
    id: record.id,
    version: record.version,
    enabled: record.enabled,
    apiUrl: record.apiUrl,
    model: record.model,
    requestTimeoutMs: record.requestTimeoutMs,
    apiKeyCiphertext: record.apiKeyCiphertext,
    apiKeyNonce: record.apiKeyNonce,
    apiKeyAuthTag: record.apiKeyAuthTag,
  };
}

export class PrismaProviderConfigurationRepository
  implements ProviderConfigurationRepository<ProviderConfigurationTransaction>
{
  constructor(private readonly client: PrismaClient) {}

  async getActive() {
    const configuration = await this.client.aiProviderConfiguration.findUnique({
      where: { id: "default" },
      include: { activeVersion: true },
    });
    return configuration?.activeVersion
      ? toVersion(configuration.activeVersion)
      : null;
  }

  async getActiveSecretConfiguration() {
    const configuration = await this.client.aiProviderConfiguration.findUnique({
      where: { id: "default" },
      include: { activeVersion: true },
    });
    return configuration?.activeVersion
      ? toVersion(configuration.activeVersion)
      : null;
  }

  transaction<T>(
    work: (transaction: ProviderConfigurationTransaction) => Promise<T>,
  ) {
    return this.client.$transaction(work);
  }

  async getLatest(transaction: ProviderConfigurationTransaction) {
    const version = await transaction.aiProviderConfigurationVersion.findFirst({
      where: { configurationId: "default" },
      orderBy: { version: "desc" },
    });
    return version ? toVersion(version) : null;
  }

  async createVersion(
    version: Omit<ProviderConfigurationVersion, "id">,
    transaction: ProviderConfigurationTransaction,
  ) {
    await transaction.aiProviderConfiguration.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
    });
    const created = await transaction.aiProviderConfigurationVersion.create({
      data: {
        configurationId: "default",
        version: version.version,
        enabled: version.enabled,
        apiUrl: version.apiUrl,
        model: version.model,
        requestTimeoutMs: version.requestTimeoutMs,
        apiKeyCiphertext: version.apiKeyCiphertext
          ? Buffer.from(version.apiKeyCiphertext)
          : null,
        apiKeyNonce: version.apiKeyNonce
          ? Buffer.from(version.apiKeyNonce)
          : null,
        apiKeyAuthTag: version.apiKeyAuthTag
          ? Buffer.from(version.apiKeyAuthTag)
          : null,
      },
    });
    return toVersion(created);
  }

  async activate(
    versionId: string,
    transaction: ProviderConfigurationTransaction,
  ) {
    await transaction.aiProviderConfiguration.update({
      where: { id: "default" },
      data: { activeVersionId: versionId },
    });
  }
}

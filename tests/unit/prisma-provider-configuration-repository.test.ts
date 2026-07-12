import { describe, expect, it, vi } from "vitest";

import { PrismaProviderConfigurationRepository } from "../../lib/ai/prisma-provider-configuration-repository";

function transaction() {
  return {
    aiProviderConfiguration: {
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    aiProviderConfigurationVersion: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: "version-1",
        version: 1,
        enabled: true,
        apiUrl: "http://provider.internal/v1",
        model: "configured-model",
        requestTimeoutMs: 30_000,
        apiKeyCiphertext: Buffer.from([1]),
        apiKeyNonce: Buffer.alloc(12),
        apiKeyAuthTag: Buffer.alloc(16),
      }),
    },
  };
}

describe("PrismaProviderConfigurationRepository", () => {
  it("creates the singleton before writing encrypted version bytes", async () => {
    const tx = transaction();
    const repository = new PrismaProviderConfigurationRepository({} as never);

    await repository.createVersion(
      {
        version: 1,
        enabled: true,
        apiUrl: "http://provider.internal/v1",
        model: "configured-model",
        requestTimeoutMs: 30_000,
        apiKeyCiphertext: new Uint8Array([1]),
        apiKeyNonce: new Uint8Array(12),
        apiKeyAuthTag: new Uint8Array(16),
      },
      tx as never,
    );

    expect(tx.aiProviderConfiguration.upsert).toHaveBeenCalledWith({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
    });
    expect(tx.aiProviderConfigurationVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          configurationId: "default",
          apiKeyCiphertext: Buffer.from([1]),
        }),
      }),
    );
  });

  it("activates a version only through the singleton pointer", async () => {
    const tx = transaction();
    const repository = new PrismaProviderConfigurationRepository({} as never);

    await repository.activate("version-1", tx as never);

    expect(tx.aiProviderConfiguration.update).toHaveBeenCalledWith({
      where: { id: "default" },
      data: { activeVersionId: "version-1" },
    });
  });
});

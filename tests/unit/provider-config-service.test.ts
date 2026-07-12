import { randomBytes } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { AuditWriter } from "../../lib/audit/audit-writer";
import { PermissionDeniedError } from "../../lib/authorization/permission-policy";
import {
  ProviderConfigurationService,
  ProviderConfigurationValidationError,
  type ProviderConfigurationRepository,
  type ProviderConfigurationVersion,
} from "../../lib/ai/provider-config-service";

type Transaction = { id: string };

function setup(latest: ProviderConfigurationVersion | null = null) {
  const transaction = { id: "tx-1" };
  const createdVersions: ProviderConfigurationVersion[] = [];
  const repository: ProviderConfigurationRepository<Transaction> = {
    getActive: vi.fn().mockResolvedValue(latest),
    transaction: vi.fn(async (work) => work(transaction)),
    getLatest: vi.fn().mockResolvedValue(latest),
    createVersion: vi.fn(async (version) => {
      const created = { ...version, id: `version-${version.version}` };
      createdVersions.push(created);
      return created;
    }),
    activate: vi.fn().mockResolvedValue(undefined),
  };
  const auditWriter: AuditWriter<Transaction> = {
    append: vi.fn(async (event) => ({
      ...event,
      id: "audit-1",
      recordedAt: new Date("2026-07-11T09:00:00.000Z"),
    })),
  };
  const service = new ProviderConfigurationService({
    repository,
    auditWriter,
    masterKey: randomBytes(32),
  });

  return { service, repository, auditWriter, transaction, createdVersions };
}

const admin = { id: "admin-1", role: "ADMIN" as const };
const validInput = {
  enabled: true,
  apiUrl: "http://ai.internal.example/v1",
  model: "approved-model",
  requestTimeoutMs: 30_000,
  apiKey: "write-only-provider-key",
};

describe("ProviderConfigurationService", () => {
  it("denies non-Admin before repository access", async () => {
    const { service, repository } = setup();

    await expect(
      service.read({ id: "sales-1", role: "SALES" }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(repository.getActive).not.toHaveBeenCalled();
  });

  it("returns only non-secret fields and configured status", async () => {
    const latest: ProviderConfigurationVersion = {
      id: "version-1",
      version: 1,
      enabled: true,
      apiUrl: validInput.apiUrl,
      model: validInput.model,
      requestTimeoutMs: validInput.requestTimeoutMs,
      apiKeyCiphertext: new Uint8Array([1]),
      apiKeyNonce: new Uint8Array(12),
      apiKeyAuthTag: new Uint8Array(16),
    };
    const { service } = setup(latest);

    const result = await service.read(admin);

    expect(result).toEqual({
      id: "version-1",
      version: 1,
      enabled: true,
      apiUrl: validInput.apiUrl,
      model: validInput.model,
      requestTimeoutMs: validInput.requestTimeoutMs,
      apiKeyConfigured: true,
    });
    expect(JSON.stringify(result)).not.toContain("apiKeyCiphertext");
  });

  it("creates, activates and audits a version in the same transaction", async () => {
    const { service, repository, auditWriter, transaction, createdVersions } =
      setup();

    const result = await service.update(admin, validInput, {
      correlationId: "request-1",
      reason: "Initial configuration",
    });

    expect(result.version).toBe(1);
    expect(result.apiKeyConfigured).toBe(true);
    expect(repository.activate).toHaveBeenCalledWith("version-1", transaction);
    expect(auditWriter.append).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-1",
        targetVersion: "1",
        data: expect.objectContaining({ apiKeyReplaced: true }),
      }),
      { transaction },
    );
    expect(JSON.stringify(createdVersions)).not.toContain(
      "write-only-provider-key",
    );
    expect(JSON.stringify(vi.mocked(auditWriter.append).mock.calls)).not.toContain(
      "write-only-provider-key",
    );
  });

  it("carries encrypted key components into the next immutable version", async () => {
    const latest: ProviderConfigurationVersion = {
      id: "version-1",
      version: 1,
      enabled: true,
      apiUrl: validInput.apiUrl,
      model: validInput.model,
      requestTimeoutMs: validInput.requestTimeoutMs,
      apiKeyCiphertext: new Uint8Array([1, 2, 3]),
      apiKeyNonce: new Uint8Array(12),
      apiKeyAuthTag: new Uint8Array(16),
    };
    const { service, createdVersions } = setup(latest);

    await service.update(
      admin,
      { ...validInput, model: "new-model", apiKey: undefined },
      { correlationId: "request-2" },
    );

    expect(createdVersions[0].version).toBe(2);
    expect(createdVersions[0].apiKeyCiphertext).toBe(
      latest.apiKeyCiphertext,
    );
  });

  it("rejects unsafe URL data and enabling without a configured key", async () => {
    const { service } = setup();

    await expect(
      service.update(
        admin,
        { ...validInput, apiUrl: "https://user:pass@example.com/v1" },
        { correlationId: "request-3" },
      ),
    ).rejects.toBeInstanceOf(ProviderConfigurationValidationError);
    await expect(
      service.update(
        admin,
        { ...validInput, apiKey: undefined },
        { correlationId: "request-4" },
      ),
    ).rejects.toBeInstanceOf(ProviderConfigurationValidationError);
  });

  it("propagates required audit failure so the transaction can roll back", async () => {
    const { service, auditWriter } = setup();
    vi.mocked(auditWriter.append).mockRejectedValueOnce(
      new Error("required audit unavailable"),
    );

    await expect(
      service.update(admin, validInput, { correlationId: "request-5" }),
    ).rejects.toThrow("required audit unavailable");
  });
});

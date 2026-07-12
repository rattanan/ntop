import type { Role } from "@prisma/client";
import { z } from "zod";

import type { AuditWriter } from "../audit/audit-writer";
import {
  assertPermission,
  PERMISSIONS,
  type PermissionPolicy,
  permissionPolicy,
} from "../authorization/permission-policy";
import { encryptProviderKey } from "./provider-key-crypto";

const providerConfigurationSchema = z.object({
  enabled: z.boolean(),
  apiUrl: z
    .url()
    .max(2048)
    .refine((value) => {
      const url = new URL(value);
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash
      );
    }, "AI provider URL must be an HTTP(S) endpoint without credentials or query data."),
  model: z.string().trim().min(1).max(255),
  requestTimeoutMs: z.number().int().min(1_000).max(120_000),
  apiKey: z.string().min(1).optional(),
});

type EncryptedKeyColumns = {
  apiKeyCiphertext: Uint8Array | null;
  apiKeyNonce: Uint8Array | null;
  apiKeyAuthTag: Uint8Array | null;
};

export type ProviderConfigurationVersion = EncryptedKeyColumns & {
  id: string;
  version: number;
  enabled: boolean;
  apiUrl: string;
  model: string;
  requestTimeoutMs: number;
};

export type ProviderConfigurationView = Omit<
  ProviderConfigurationVersion,
  keyof EncryptedKeyColumns
> & {
  apiKeyConfigured: boolean;
};

export type ProviderConfigurationUpdate = z.input<
  typeof providerConfigurationSchema
>;

export interface ProviderConfigurationRepository<TTransaction> {
  getActive(): Promise<ProviderConfigurationVersion | null>;
  transaction<T>(work: (transaction: TTransaction) => Promise<T>): Promise<T>;
  getLatest(
    transaction: TTransaction,
  ): Promise<ProviderConfigurationVersion | null>;
  createVersion(
    version: Omit<ProviderConfigurationVersion, "id">,
    transaction: TTransaction,
  ): Promise<ProviderConfigurationVersion>;
  activate(versionId: string, transaction: TTransaction): Promise<void>;
}

export class ProviderConfigurationValidationError extends Error {
  readonly issues: Record<string, string[]>;

  constructor(issues: Record<string, string[]>) {
    super("AI provider configuration is invalid.");
    this.name = "ProviderConfigurationValidationError";
    this.issues = issues;
  }
}

type ProviderConfigurationActor = {
  id: string;
  role: Role;
};

type ProviderConfigurationServiceDependencies<TTransaction> = {
  repository: ProviderConfigurationRepository<TTransaction>;
  auditWriter: AuditWriter<TTransaction>;
  masterKey: Uint8Array;
  policy?: PermissionPolicy;
};

function hasConfiguredKey(version: EncryptedKeyColumns) {
  return Boolean(
    version.apiKeyCiphertext && version.apiKeyNonce && version.apiKeyAuthTag,
  );
}

function toView(
  version: ProviderConfigurationVersion,
): ProviderConfigurationView {
  return {
    id: version.id,
    version: version.version,
    enabled: version.enabled,
    apiUrl: version.apiUrl,
    model: version.model,
    requestTimeoutMs: version.requestTimeoutMs,
    apiKeyConfigured: hasConfiguredKey(version),
  };
}

export class ProviderConfigurationService<TTransaction> {
  private readonly repository: ProviderConfigurationRepository<TTransaction>;
  private readonly auditWriter: AuditWriter<TTransaction>;
  private readonly masterKey: Uint8Array;
  private readonly policy: PermissionPolicy;

  constructor({
    repository,
    auditWriter,
    masterKey,
    policy = permissionPolicy,
  }: ProviderConfigurationServiceDependencies<TTransaction>) {
    this.repository = repository;
    this.auditWriter = auditWriter;
    this.masterKey = masterKey;
    this.policy = policy;
  }

  async read(actor: ProviderConfigurationActor) {
    assertPermission(actor, PERMISSIONS.aiConfigManage, this.policy);
    const active = await this.repository.getActive();

    return active ? toView(active) : null;
  }

  async update(
    actor: ProviderConfigurationActor,
    input: ProviderConfigurationUpdate,
    context: { correlationId: string; reason?: string },
  ) {
    assertPermission(actor, PERMISSIONS.aiConfigManage, this.policy);
    const parsed = providerConfigurationSchema.safeParse(input);
    if (!parsed.success) {
      throw new ProviderConfigurationValidationError(
        parsed.error.flatten().fieldErrors,
      );
    }

    return this.repository.transaction(async (transaction) => {
      const latest = await this.repository.getLatest(transaction);
      const encrypted = parsed.data.apiKey
        ? encryptProviderKey(parsed.data.apiKey, this.masterKey)
        : null;
      const keyColumns: EncryptedKeyColumns = encrypted
        ? {
            apiKeyCiphertext: encrypted.ciphertext,
            apiKeyNonce: encrypted.nonce,
            apiKeyAuthTag: encrypted.authTag,
          }
        : {
            apiKeyCiphertext: latest?.apiKeyCiphertext ?? null,
            apiKeyNonce: latest?.apiKeyNonce ?? null,
            apiKeyAuthTag: latest?.apiKeyAuthTag ?? null,
          };

      if (parsed.data.enabled && !hasConfiguredKey(keyColumns)) {
        throw new ProviderConfigurationValidationError({
          apiKey: ["An API key is required before enabling AI."],
        });
      }

      const created = await this.repository.createVersion(
        {
          version: (latest?.version ?? 0) + 1,
          enabled: parsed.data.enabled,
          apiUrl: parsed.data.apiUrl,
          model: parsed.data.model,
          requestTimeoutMs: parsed.data.requestTimeoutMs,
          ...keyColumns,
        },
        transaction,
      );
      await this.repository.activate(created.id, transaction);
      await this.auditWriter.append(
        {
          actorId: actor.id,
          action: "ai.provider.configuration.update",
          targetType: "AiProviderConfiguration",
          targetId: "default",
          targetVersion: String(created.version),
          outcome: "SUCCESS",
          correlationId: context.correlationId,
          reason: context.reason,
          data: {
            enabled: created.enabled,
            apiUrl: created.apiUrl,
            model: created.model,
            requestTimeoutMs: created.requestTimeoutMs,
            apiKeyReplaced: Boolean(parsed.data.apiKey),
          },
        },
        { transaction },
      );

      return toView(created);
    });
  }
}

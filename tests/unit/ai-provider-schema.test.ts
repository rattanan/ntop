import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  join(
    process.cwd(),
    "prisma/migrations/20260711160000_add_ai_provider_configuration/migration.sql",
  ),
  "utf8",
);
const legacyMigration = readFileSync(
  join(process.cwd(), "prisma/legacy-mariadb-5.5-ai-provider-configuration.sql"),
  "utf8",
);
const keySetup = readFileSync(
  join(process.cwd(), "scripts/ensure-ai-master-key.mjs"),
  "utf8",
);

describe("AI provider configuration persistence", () => {
  it("defines singleton version history and an active-version pointer", () => {
    expect(schema).toContain("model AiProviderConfiguration {");
    expect(schema).toContain("model AiProviderConfigurationVersion {");
    expect(schema).toContain("@@unique([configurationId, version])");
    expect(migration).toContain("AiProviderConfiguration_singleton_chk");
  });

  it("stores only authenticated-encryption key components", () => {
    expect(schema).toContain("apiKeyCiphertext");
    expect(schema).toContain("apiKeyNonce");
    expect(schema).toContain("apiKeyAuthTag");
    expect(schema).not.toMatch(/\bapiKey\s+String/);
    expect(migration).toContain(
      "AiProviderConfigurationVersion_key_parts_chk",
    );
  });

  it("documents and targets a forward-only MySQL 8 migration", () => {
    expect(migration).toContain("MySQL 8 production-target migration");
    expect(migration).toContain("requestTimeoutMs");
    expect(migration).not.toContain("DROP TABLE");
  });

  it("provides an additive MariaDB 5.5 compatibility migration", () => {
    expect(legacyMigration).toContain("CREATE TABLE `AiProviderConfiguration`");
    expect(legacyMigration).toContain("CREATE TABLE `AiProviderConfigurationVersion`");
    expect(legacyMigration).toContain("`apiKeyCiphertext` VARBINARY(4096) NULL");
    expect(legacyMigration).toContain("`createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
    expect(legacyMigration).toContain("20260711160000_add_ai_provider_configuration");
    expect(legacyMigration).not.toContain("DROP TABLE");
  });

  it("generates a development key without printing or overwriting it", () => {
    expect(keySetup).toContain('process.env.NODE_ENV === "production"');
    expect(keySetup).toContain("randomBytes(32).toString(\"base64\")");
    expect(keySetup).toContain("is already configured and valid");
    expect(keySetup).not.toContain("console.log(generated)");
  });
});

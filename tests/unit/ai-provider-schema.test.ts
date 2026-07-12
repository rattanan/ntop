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
});

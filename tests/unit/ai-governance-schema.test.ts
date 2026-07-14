import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  join(
    process.cwd(),
    "prisma/migrations/20260711180000_add_ai_governance/migration.sql",
  ),
  "utf8",
);

describe("AI governance persistence", () => {
  it("defines job idempotency, leasing and bounded retry fields", () => {
    expect(schema).toContain("model AiJob {");
    expect(schema).toMatch(/idempotencyKey\s+String\s+@unique/);
    expect(schema).toContain("leaseExpiresAt");
    expect(migration).toContain("AiJob_retry_bounds_chk");
  });

  it("stores required provenance and expiry/legal-hold controls", () => {
    for (const field of [
      "outputSchemaVersion",
      "providerConfigurationVersionId",
      "providerModel",
      "promptTemplateVersion",
      "inputSourceReferences",
      "safetyResult",
      "confidenceBand",
      "expiresAt",
      "legalHold",
    ]) {
      expect(schema).toContain(field);
    }
  });

  it("contains no raw prompt, raw response or training-consent column", () => {
    expect(schema).not.toMatch(/\brawPrompt\b/i);
    expect(schema).not.toMatch(/\brawResponse\b/i);
    expect(schema).not.toMatch(/\btrainingConsent\b/i);
    expect(migration).not.toMatch(/`rawPrompt`|`rawResponse`|`trainingConsent`/i);
  });

  it("keeps feedback ratings constrained to approved values", () => {
    expect(migration).toContain(
      "ENUM('HELPFUL','INCORRECT','UNSAFE')",
    );
    expect(migration).not.toContain("DROP TABLE");
  });
});

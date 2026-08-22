import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("per-user API key persistence", () => {
  const schema = read("prisma/schema.prisma");
  const forward = read("prisma/migrations/20260821090000_add_user_api_keys/migration.sql");
  const legacy = read("prisma/legacy-mariadb-5.5-user-api-keys.sql");

  it("stores only a hash, masked prefix and issuance time", () => {
    expect(schema).toContain("apiKeyHash");
    expect(schema).toContain("apiKeyPrefix");
    expect(schema).toContain("apiKeyCreatedAt");
    expect(schema).not.toContain("apiKeyPlaintext");
  });

  it("ships non-destructive forward and legacy migrations", () => {
    expect(forward).toContain("ADD COLUMN `apiKeyHash`");
    expect(legacy).toContain("LegacySchemaMigration");
    expect(forward + legacy).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
  });
});

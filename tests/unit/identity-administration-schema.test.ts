import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("identity administration persistence", () => {
  const schema = read("prisma/schema.prisma");
  const forward = read("prisma/migrations/20260714140000_add_identity_admin_login_history/migration.sql");
  const legacy = read("prisma/legacy-mariadb-5.5-identity-admin-login-history.sql");

  it("adds account lifecycle and privacy-preserving login history", () => {
    expect(schema).toContain("active                       Boolean");
    expect(schema).toContain("model LoginEvent {");
    expect(schema).toContain("identifierHash");
    expect(schema).not.toContain("model LoginEvent {\n  email");
  });

  it("provides non-destructive MySQL 8 and MariaDB 5.5 migrations", () => {
    expect(forward).toContain("CREATE TABLE `LoginEvent`");
    expect(legacy).toContain("LegacySchemaMigration");
    expect(legacy).toContain("DATETIME NOT NULL");
    expect(forward + legacy).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
  });
});

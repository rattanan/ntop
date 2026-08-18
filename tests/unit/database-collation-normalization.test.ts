import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "prisma/migrations/20260809210000_normalize_application_collations/migration.sql",
  "utf8",
);

describe("application collation normalization migration", () => {
  it("normalizes every drifted application table and restores foreign-key checks", () => {
    const alterations = migration.match(
      /ALTER TABLE `[^`]+` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;/g,
    );

    expect(alterations).toHaveLength(114);
    expect(migration).toContain("SET FOREIGN_KEY_CHECKS = 0;");
    expect(migration.trimEnd()).toMatch(/SET FOREIGN_KEY_CHECKS = 1;$/);
    expect(migration).not.toContain("ALTER TABLE `_prisma_migrations`");
  });

  it("normalizes the MariaDB compatibility ledger only when it exists", () => {
    expect(migration).toContain("TABLE_NAME = 'LegacySchemaMigration'");
    expect(migration).toContain("@legacy_schema_migration_exists > 0");
    expect(migration).toContain(
      "'ALTER TABLE `LegacySchemaMigration` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'",
    );
    expect(migration).toContain("'SELECT 1'");
  });
});

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "prisma/migrations/20260809211500_align_optional_activity_history_collation/migration.sql",
  "utf8",
);

describe("optional activity history collation migration", () => {
  it("guards the legacy table and preserves its foreign-key behavior", () => {
    expect(migration).toContain("INFORMATION_SCHEMA.TABLES");
    expect(migration).toContain("@activity_history_exists > 0");
    expect(migration).toContain(
      "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL",
    );
    expect(migration).toContain("ON DELETE RESTRICT ON UPDATE CASCADE");
    expect(migration.match(/'SELECT 1'/g)).toHaveLength(3);
  });
});

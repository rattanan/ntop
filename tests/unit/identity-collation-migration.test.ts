import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "prisma/migrations/20260809203000_align_user_role_assignment_user_collation/migration.sql",
  "utf8",
);

describe("identity assignment collation migration", () => {
  it("aligns the user foreign-key column and preserves its referential actions", () => {
    expect(migration).toContain("DROP FOREIGN KEY `UserRoleAssignment_userId_fkey`");
    expect(migration).toMatch(
      /MODIFY `userId` VARCHAR\(191\)[\s\S]*CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL/,
    );
    expect(migration).toMatch(
      /FOREIGN KEY \(`userId`\) REFERENCES `User`\(`id`\)[\s\S]*ON DELETE RESTRICT ON UPDATE CASCADE/,
    );
  });
});

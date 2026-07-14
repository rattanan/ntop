import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  join(
    process.cwd(),
    "prisma/migrations/20260713194500_add_customer_foundation/migration.sql",
  ),
  "utf8",
);

describe("Customer Foundation persistence", () => {
  it("expands the legacy Customer without destructive migration", () => {
    expect(schema).toContain("version         Int");
    expect(schema).toContain("model CustomerExternalId {");
    expect(schema).toContain("model CustomerRelationship {");
    expect(schema).toContain("model CustomerOwnershipAssignment {");
    expect(schema).toContain("model CustomerMergeHistory {");
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
  });

  it("enforces identity, hierarchy and idempotency invariants", () => {
    expect(schema).toContain("@@unique([sourceSystem, externalId])");
    expect(migration).toContain("CustomerRelationship_not_self_chk");
    expect(migration).toContain("CustomerRelationship_period_chk");
    expect(schema).toContain(
      "@@unique([actorId, idempotencyKey, command])",
    );
    expect(schema).toContain("model RolePermissionGrant {");
    expect(schema).toContain("@@unique([roleCode, permissionCode])");
  });

  it("backfills effective ownership without applying the migration in tests", () => {
    expect(migration).toContain(
      "INSERT INTO `CustomerOwnershipAssignment`",
    );
    expect(migration).toContain(
      "Migration bootstrap from Customer.ownerId",
    );
  });
});

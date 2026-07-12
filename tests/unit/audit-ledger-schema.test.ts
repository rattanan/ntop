import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  join(
    process.cwd(),
    "prisma/migrations/20260711200000_add_audit_ledger/migration.sql",
  ),
  "utf8",
);

describe("append-only audit ledger persistence", () => {
  it("defines a singleton ledger and ordered hash-chained events", () => {
    expect(schema).toContain("model AuditLedger {");
    expect(schema).toContain("model AuditEvent {");
    expect(schema).toContain("sequence      BigInt   @unique");
    expect(schema).toContain("previousHash  String   @db.Char(64)");
    expect(schema).toContain("eventHash     String   @db.Char(64)");
    expect(migration).toContain("AuditLedger_singleton_chk");
    expect(migration).toContain("REPEAT('0', 64)");
  });

  it("contains audit envelope fields without mutable timestamps", () => {
    for (const field of [
      "actorId",
      "action",
      "targetType",
      "targetId",
      "targetVersion",
      "correlationId",
      "recordedAt",
    ]) {
      expect(schema).toContain(field);
    }
    const auditEventBlock = schema.match(/model AuditEvent \{[\s\S]*?\n\}/)?.[0];
    expect(auditEventBlock).not.toContain("updatedAt");
  });

  it("documents production insert/read-only database privileges", () => {
    expect(migration).toContain("SELECT/INSERT");
    expect(migration).not.toContain("DROP TABLE");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Contract service-order handoff contract", () => {
  it("adds an expand-only database idempotency key", () => {
    const schema = read("prisma/schema.prisma");
    const migration = read("prisma/migrations/20260809194500_add_service_order_business_key/migration.sql");

    expect(schema).toMatch(/businessKey\s+String\?\s+@unique/);
    expect(migration).toContain("ADD COLUMN `businessKey`");
    expect(migration).toContain("CREATE UNIQUE INDEX `ContractServiceOrder_businessKey_key`");
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN|DELETE FROM/);
  });

  it("uses configured status category and guards duplicate writes", () => {
    const service = read("lib/contract/contract-service.ts");
    const repository = read("lib/contract/prisma-contract-repository.ts");

    expect(service).toContain('contract.reportingCategory !== "ACTIVE"');
    expect(service).toContain("findServiceOrder(contract.id, contract.latestVersionId");
    expect(service).not.toContain('new Set(["EFFECTIVE", "READY_FOR_SERVICE_ORDER"])');
    expect(repository).toContain("contractServiceOrder.upsert");
    expect(repository).toContain("businessKey");
  });

  it("exposes a guarded UI action and labels manual handoff honestly", () => {
    const controls = read("components/contract-workflow-controls.tsx");

    expect(controls).toContain('data-testid="contract-service-order-submit"');
    expect(controls).toContain("canCreateServiceOrder");
    expect(controls).toContain("ยังไม่ถือว่า NTSP integration สำเร็จ");
    expect(controls).toContain('disabled={pending !== null}');
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("fiscal calendar and sales target schema", () => {
  it("keeps money decimal-safe and calendar settings configurable", () => {
    const schema = read("prisma/schema.prisma");
    expect(schema).toContain("model FiscalCalendar");
    expect(schema).toContain("fiscalYearStartMonth");
    expect(schema).toContain("reportingCutoffHour");
    expect(schema).toMatch(/targetAmount\s+Decimal\s+@db\.Decimal\(19, 4\)/);
    expect(schema).toMatch(/targetRecurringRevenue\s+Decimal\?\s+@db\.Decimal\(19, 4\)/);
  });

  it("ships an additive migration with scope and effective-range indexes", () => {
    const migration = read("prisma/migrations/20260716010000_add_fiscal_calendar_sales_targets/migration.sql");
    expect(migration).toContain("CREATE TABLE `FiscalCalendar`");
    expect(migration).toContain("CREATE TABLE `SalesTarget`");
    expect(migration).toContain("SalesTarget_scope_status_effective_idx");
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN/);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/20260809223000_add_dashboard_operational_read_models/migration.sql", "utf8");
const drilldownMigration = readFileSync("prisma/migrations/20260810002500_grant_dashboard_source_drilldowns/migration.sql", "utf8");

describe("dashboard operational read models", () => {
  it("adds indexed incident SLA data and backward-compatible service-order milestones", () => {
    expect(schema).toContain("model CustomerIncident");
    expect(schema).toContain("@@index([slaDueAt, resolvedAt])");
    expect(schema).toContain("targetCompletionAt      DateTime?");
    expect(schema).toContain("installationCompletedAt DateTime?");
    expect(migration).toContain("ADD COLUMN `targetCompletionAt` DATETIME(3) NULL");
    expect(migration).toMatch(/CREATE TABLE(?: IF NOT EXISTS)? `CustomerIncident`/);
  });

  it("installs dashboard grants through migration rather than UI role checks", () => {
    expect(migration).toContain("dashboard.section.customer-success");
    expect(migration).toContain("dashboard.section.admin");
    expect(migration).toContain("dashboard.export");
    expect(drilldownMigration).toContain("WHERE `permissionCode` = 'dashboard.view'");
    expect(drilldownMigration).toContain("'prospect.view_all'");
    expect(drilldownMigration).toContain("'contract.view'");
  });
});

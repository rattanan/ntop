import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260713220000_add_opportunity_pipeline_quote_approval/migration.sql");
const compatibilityMigration = read("prisma/legacy-mariadb-5.5-opportunity-commercial.sql");

describe("Opportunity/Pipeline/Quote/Approval persistence", () => {
  it("adds optimistic stage history and configured transitions", () => {
    expect(schema).toContain("model OpportunityStageHistory {");
    expect(schema).toContain("model OpportunityTransitionPolicyVersion {");
    expect(schema).toContain("model OpportunityCommandReceipt {");
    expect(migration).toContain("QUALIFY_DISCOVER");
    expect(migration).toContain("WON_REOPEN");
  });

  it("stores money as Decimal and immutable commercial versions", () => {
    expect(schema).toContain("model QuoteVersion {");
    expect(schema).toContain("model QuoteVersionItem {");
    expect(schema).toContain("@db.Decimal(19, 4)");
    expect(migration).toContain("Backfill governed immutable versions");
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
  });

  it("persists immutable forecast and reconstructable approval evidence", () => {
    expect(schema).toContain("model ForecastSnapshot {");
    expect(schema).toContain("snapshotKey");
    expect(schema).toContain("model ApprovalPolicyVersion {");
    expect(schema).toContain("previousHash");
    expect(schema).toContain("decisionHash");
    expect(migration).toContain("ApprovalAuthorityGrant");
  });

  it("provides a non-destructive MariaDB 5.5 compatibility path", () => {
    expect(compatibilityMigration).toContain("LONGTEXT");
    expect(compatibilityMigration).toContain("receiptHash");
    expect(compatibilityMigration).toContain("LegacySchemaMigration");
    expect(compatibilityMigration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
  });

  it("adds floor price through additive forward and compatibility migrations", () => {
    const floorMigration = read("prisma/migrations/20260714100000_add_product_floor_price/migration.sql");
    const floorCompatibility = read("prisma/legacy-mariadb-5.5-product-floor-price.sql");
    expect(schema).toMatch(/floorPrice\s+Decimal\?/);
    expect(floorMigration).toContain("ADD COLUMN `floorPrice`");
    expect(floorCompatibility).toContain("20260714100000_add_product_floor_price");
    expect(floorMigration + floorCompatibility).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
  });
});

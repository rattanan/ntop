import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "prisma/migrations/20260710010000_normalize_initial_mysql8_charset/migration.sql",
  "utf8",
);
const phase1Migration = readFileSync(
  "prisma/migrations/20260710020000_add_phase1_core_tables/migration.sql",
  "utf8",
);
const customerFoundationMigration = readFileSync(
  "prisma/migrations/20260713194500_add_customer_foundation/migration.sql",
  "utf8",
);
const presalesPreparationMigration = readFileSync(
  "prisma/migrations/20260715140000_prepare_presales_core/migration.sql",
  "utf8",
);

describe("MySQL 8 bootstrap collation", () => {
  it("normalizes every initial table before later foreign keys are created", () => {
    for (const table of ["User", "Customer", "Contact", "Opportunity", "VendorAssessment"]) {
      expect(migration).toContain(
        `ALTER TABLE \`${table}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
    }
  });

  it("is forward-only and preserves foreign-key enforcement after conversion", () => {
    expect(migration).toContain("SET FOREIGN_KEY_CHECKS = 0");
    expect(migration).toContain("SET FOREIGN_KEY_CHECKS = 1");
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
  });

  it("keeps quoted MySQL identifiers within the 64-character limit", () => {
    const migrationRoot = "prisma/migrations";
    for (const directory of readdirSync(migrationRoot)) {
      const file = join(migrationRoot, directory, "migration.sql");
      let source: string;
      try {
        source = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      for (const match of source.matchAll(/`([^`]+)`/g)) {
        expect(match[1].length, `${directory}: ${match[1]}`).toBeLessThanOrEqual(64);
      }
    }
  });

  it("does not mix general and unicode collations in MySQL migrations", () => {
    const migrationRoot = "prisma/migrations";
    for (const directory of readdirSync(migrationRoot)) {
      const file = join(migrationRoot, directory, "migration.sql");
      let source: string;
      try {
        source = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      expect(source, directory).not.toContain("utf8mb4_general_ci");
      expect(source, directory).not.toMatch(/DEFAULT CHARACTER SET utf8mb4;/);
    }
  });

  it("bootstraps the legacy Phase 1 tables before dependent migrations", () => {
    for (const table of [
      "Lead",
      "Activity",
      "Product",
      "Quote",
      "QuoteItem",
      "Approval",
      "CoverageCheck",
      "SolutionDesign",
      "InternalOrder",
    ]) {
      expect(phase1Migration).toContain(`CREATE TABLE IF NOT EXISTS \`${table}\``);
    }
    expect(phase1Migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
  });

  it("keeps self-reference checks compatible with immutable customer IDs", () => {
    for (const constraint of [
      "CustomerRelationship_parentCustomerId_fkey",
      "CustomerRelationship_childCustomerId_fkey",
      "CustomerMergeHistory_sourceCustomerId_fkey",
      "CustomerMergeHistory_targetCustomerId_fkey",
      "CustomerDuplicateCandidate_customerAId_fkey",
      "CustomerDuplicateCandidate_customerBId_fkey",
    ]) {
      const start = customerFoundationMigration.indexOf(constraint);
      expect(start).toBeGreaterThan(-1);
      expect(customerFoundationMigration.slice(start, start + 300)).toContain("ON UPDATE RESTRICT");
    }
  });

  it("recovers missing Presales columns idempotently before the continuation migration", () => {
    expect(presalesPreparationMigration).toContain("information_schema.COLUMNS");
    expect(presalesPreparationMigration).toContain("TABLE_NAME = 'Product'");
    expect(presalesPreparationMigration).toContain("COLUMN_NAME = 'serviceCategoryCode'");
    expect(presalesPreparationMigration).toContain("TABLE_NAME = 'SolutionDesign'");
    expect(presalesPreparationMigration).toContain("COLUMN_NAME = 'statusCode'");
    expect(presalesPreparationMigration).toContain(
      "CREATE TABLE IF NOT EXISTS `PresalesNumberSequence`",
    );
    expect(presalesPreparationMigration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
  });
});

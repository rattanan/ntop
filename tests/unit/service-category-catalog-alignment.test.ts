import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const migration = read("prisma/migrations/20260827183000_align_service_categories_with_catalog/migration.sql");
const legacy = read("prisma/legacy-mariadb-5.5-align-service-categories.sql");
const seed = read("prisma/seed.ts");
const categoryCodes = ["BROADBAND", "DATACOM", "HARD_INFRASTRUCTURE", "INTERNATIONAL", "SATELLITE", "VOICE"];

describe("Service Category and Product Catalog alignment", () => {
  it("creates the six approved categories with Survey, BOQ and physical-installation gates disabled", () => {
    for (const source of [migration, legacy]) {
      for (const code of categoryCodes) expect(source).toContain(`'${code}'`);
      expect(source).toContain("`requiresSiteSurvey` = false");
      expect(source).toContain("`requiresBoq` = false");
      expect(source).toContain("`requiresPhysicalInstallation` = false");
      expect(source).not.toMatch(/DROP|TRUNCATE|DELETE\s+FROM/i);
    }
  });

  it("backfills every approved legacy Product category to the corresponding code", () => {
    for (const [name, code] of [["Broadband", "BROADBAND"], ["Datacom", "DATACOM"], ["Hard Infrastructure", "HARD_INFRASTRUCTURE"], ["International", "INTERNATIONAL"], ["Satellite", "SATELLITE"], ["Voice", "VOICE"]]) {
      expect(migration).toContain(`WHEN '${name}' THEN '${code}'`);
      expect(legacy).toContain(`WHEN '${name}' THEN '${code}'`);
    }
    expect(migration).toContain("`version` = `version` + 1");
    expect(migration).toContain("WHERE `deletedAt` IS NULL");
  });

  it("seeds only the six approved categories without overwriting later administrator changes", () => {
    for (const code of categoryCodes) expect(seed).toContain(`${code}:`);
    expect(seed).toContain("serviceCategoryConfig.upsert({where:{code},update:{},create:");
    expect(seed).not.toContain("surveyCategoryCodes");
  });
});

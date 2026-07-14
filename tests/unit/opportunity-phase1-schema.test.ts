import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/20260714233000_add_opportunity_number_probability_history/migration.sql", "utf8");

describe("Opportunity Phase 1 identity and probability evidence", () => {
  it("defines a unique human-readable number and concurrency sequence", () => {
    expect(schema).toMatch(/opportunityNumber\s+String\?/);
    expect(schema).toContain("model OpportunityNumberSequence");
    expect(migration).toContain("Opportunity_opportunityNumber_key");
    expect(readFileSync("lib/lead/prisma-lead-repository.ts", "utf8")).toContain("opportunityNumberSequence.update");
  });

  it("persists append-only probability override evidence", () => {
    expect(schema).toContain("model OpportunityProbabilityHistory");
    expect(schema).toContain("@@unique([opportunityId, aggregateVersion])");
    expect(migration).toContain("OpportunityProbabilityHistory_changedById_fkey");
  });
});

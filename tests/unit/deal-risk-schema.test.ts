import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  join(
    process.cwd(),
    "prisma/migrations/20260711190000_add_deal_risk_rules/migration.sql",
  ),
  "utf8",
);

describe("versioned Deal Risk persistence", () => {
  it("stores effective immutable rule versions with configurable policy data", () => {
    expect(schema).toContain("model DealRiskRuleVersion {");
    expect(schema).toContain("@@unique([ruleId, version])");
    for (const field of [
      "conditionConfig",
      "thresholdConfig",
      "scopeConfig",
      "severityConfig",
      "effectiveFrom",
    ]) {
      expect(schema).toContain(field);
    }
    expect(migration).toContain("DealRiskRuleVersion_effective_period_chk");
  });

  it("stores immutable signal evidence and an idempotent evaluation key", () => {
    expect(schema).toContain("model DealRiskSignal {");
    expect(schema).toContain("thresholdSnapshot");
    expect(schema).toContain("triggeringFacts");
    expect(schema).toContain("severitySnapshot");
    expect(schema).toContain(
      "@@unique([opportunityId, ruleVersionId, evaluationKey])",
    );
  });

  it("does not embed stage, segment or numeric threshold policy in columns", () => {
    expect(schema).not.toMatch(/stageFilter|segmentFilter|thresholdDays/);
    expect(migration).not.toContain("DROP TABLE");
  });
});

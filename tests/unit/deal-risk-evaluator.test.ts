import { describe, expect, it } from "vitest";

import {
  dealRiskRuleConfigurationSchema,
  evaluateDealRiskRule,
  type DealRiskRuleVersionForEvaluation,
} from "../../lib/ai/deal-risk-evaluator";

const evaluatedAt = new Date("2026-07-11T05:00:00.000Z");
const opportunity = {
  id: "opportunity-1",
  stage: "NEGOTIATION",
  segment: "ENTERPRISE",
  expectedCloseAt: new Date("2026-07-08T05:00:00.000Z"),
  lastActivityAt: new Date("2026-06-30T05:00:00.000Z"),
  nextAction: null,
};

function rule(
  configuration: DealRiskRuleVersionForEvaluation["configuration"],
): DealRiskRuleVersionForEvaluation {
  return { id: "rule-version-1", riskType: "CONFIGURED_RISK", configuration };
}

describe("deterministic Deal Risk evaluator", () => {
  it("returns the same signal for the same facts and rule version", () => {
    const configuredRule = rule({
      condition: {
        metric: "LAST_ACTIVITY_AGE_DAYS",
        operator: "GT",
        threshold: 7,
        onMissing: "TRIGGER",
      },
      scope: { stages: ["NEGOTIATION"], segments: ["ENTERPRISE"] },
      severity: { band: "HIGH" },
    });

    const first = evaluateDealRiskRule({
      rule: configuredRule,
      opportunity,
      evaluatedAt,
    });
    const second = evaluateDealRiskRule({
      rule: configuredRule,
      opportunity,
      evaluatedAt,
    });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      thresholdSnapshot: expect.objectContaining({ threshold: 7 }),
      triggeringFacts: expect.objectContaining({ observedValue: 11 }),
    });
  });

  it("evaluates overdue close date and missing next action from configuration", () => {
    const overdue = evaluateDealRiskRule({
      rule: rule({
        condition: {
          metric: "CLOSE_DATE_OVERDUE_DAYS",
          operator: "GTE",
          threshold: 3,
          onMissing: "IGNORE",
        },
        scope: {},
        severity: { band: "MEDIUM" },
      }),
      opportunity,
      evaluatedAt,
    });
    const missingAction = evaluateDealRiskRule({
      rule: rule({
        condition: {
          metric: "NEXT_ACTION_MISSING",
          operator: "GTE",
          threshold: 1,
          onMissing: "TRIGGER",
        },
        scope: {},
        severity: { band: "LOW" },
      }),
      opportunity,
      evaluatedAt,
    });

    expect(overdue?.triggeringFacts.observedValue).toBe(3);
    expect(missingAction?.triggeringFacts.observedValue).toBe(1);
  });

  it("uses configured scope and missing-data behavior without hard-coded segment/stage policy", () => {
    expect(
      evaluateDealRiskRule({
        rule: rule({
          condition: {
            metric: "LAST_ACTIVITY_AGE_DAYS",
            operator: "GT",
            threshold: 0,
            onMissing: "TRIGGER",
          },
          scope: { segments: ["OTHER"] },
          severity: {},
        }),
        opportunity,
        evaluatedAt,
      }),
    ).toBeNull();

    const missingActivity = evaluateDealRiskRule({
      rule: rule({
        condition: {
          metric: "LAST_ACTIVITY_AGE_DAYS",
          operator: "GT",
          threshold: 30,
          onMissing: "TRIGGER",
        },
        scope: {},
        severity: {},
      }),
      opportunity: { ...opportunity, lastActivityAt: null },
      evaluatedAt,
    });
    expect(missingActivity?.triggeringFacts.observedValue).toBeNull();
  });

  it("rejects invalid policy shape instead of silently accepting it", () => {
    expect(
      dealRiskRuleConfigurationSchema.safeParse({
        condition: {
          metric: "LAST_ACTIVITY_AGE_DAYS",
          operator: "GT",
          threshold: 7.5,
          onMissing: "TRIGGER",
        },
        scope: {},
        severity: {},
      }).success,
    ).toBe(false);
  });
});

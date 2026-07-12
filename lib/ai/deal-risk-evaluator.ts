import { z } from "zod";

const DAY_MS = 24 * 60 * 60 * 1_000;

const riskConditionSchema = z.strictObject({
  metric: z.enum([
    "LAST_ACTIVITY_AGE_DAYS",
    "CLOSE_DATE_OVERDUE_DAYS",
    "NEXT_ACTION_MISSING",
  ]),
  operator: z.enum(["GT", "GTE"]),
  threshold: z.number().int().nonnegative(),
  onMissing: z.enum(["TRIGGER", "IGNORE"]),
});

const riskScopeSchema = z.strictObject({
  stages: z.array(z.string()).min(1).optional(),
  segments: z.array(z.string()).min(1).optional(),
});

export const dealRiskRuleConfigurationSchema = z.strictObject({
  condition: riskConditionSchema,
  scope: riskScopeSchema,
  severity: z.record(z.string(), z.unknown()),
});

export type DealRiskRuleConfiguration = z.infer<
  typeof dealRiskRuleConfigurationSchema
>;

export type RiskEvaluationOpportunity = {
  id: string;
  stage: string;
  segment: string;
  expectedCloseAt: Date | null;
  lastActivityAt: Date | null;
  nextAction: string | null;
};

export type DealRiskRuleVersionForEvaluation = {
  id: string;
  riskType: string;
  configuration: DealRiskRuleConfiguration;
};

export type EvaluatedDealRiskSignal = {
  opportunityId: string;
  ruleVersionId: string;
  riskType: string;
  thresholdSnapshot: DealRiskRuleConfiguration["condition"];
  triggeringFacts: {
    metric: DealRiskRuleConfiguration["condition"]["metric"];
    observedValue: number | null;
    evaluatedAt: string;
    stage: string;
    segment: string;
  };
  severitySnapshot: DealRiskRuleConfiguration["severity"];
};

function fullDaysSince(now: Date, then: Date) {
  return Math.floor((now.getTime() - then.getTime()) / DAY_MS);
}

function observedMetric(
  metric: DealRiskRuleConfiguration["condition"]["metric"],
  opportunity: RiskEvaluationOpportunity,
  evaluatedAt: Date,
) {
  switch (metric) {
    case "LAST_ACTIVITY_AGE_DAYS":
      return opportunity.lastActivityAt
        ? fullDaysSince(evaluatedAt, opportunity.lastActivityAt)
        : null;
    case "CLOSE_DATE_OVERDUE_DAYS":
      return opportunity.expectedCloseAt
        ? fullDaysSince(evaluatedAt, opportunity.expectedCloseAt)
        : null;
    case "NEXT_ACTION_MISSING":
      return opportunity.nextAction?.trim() ? 0 : 1;
  }
}

function isInScope(
  scope: DealRiskRuleConfiguration["scope"],
  opportunity: RiskEvaluationOpportunity,
) {
  return (
    (!scope.stages || scope.stages.includes(opportunity.stage)) &&
    (!scope.segments || scope.segments.includes(opportunity.segment))
  );
}

function matchesCondition(
  condition: DealRiskRuleConfiguration["condition"],
  observedValue: number | null,
) {
  if (observedValue === null) return condition.onMissing === "TRIGGER";
  return condition.operator === "GT"
    ? observedValue > condition.threshold
    : observedValue >= condition.threshold;
}

export function evaluateDealRiskRule({
  rule,
  opportunity,
  evaluatedAt,
}: {
  rule: DealRiskRuleVersionForEvaluation;
  opportunity: RiskEvaluationOpportunity;
  evaluatedAt: Date;
}): EvaluatedDealRiskSignal | null {
  if (!isInScope(rule.configuration.scope, opportunity)) return null;

  const observedValue = observedMetric(
    rule.configuration.condition.metric,
    opportunity,
    evaluatedAt,
  );
  if (!matchesCondition(rule.configuration.condition, observedValue)) {
    return null;
  }

  return {
    opportunityId: opportunity.id,
    ruleVersionId: rule.id,
    riskType: rule.riskType,
    thresholdSnapshot: rule.configuration.condition,
    triggeringFacts: {
      metric: rule.configuration.condition.metric,
      observedValue,
      evaluatedAt: evaluatedAt.toISOString(),
      stage: opportunity.stage,
      segment: opportunity.segment,
    },
    severitySnapshot: rule.configuration.severity,
  };
}

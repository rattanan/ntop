import { decimal, type DecimalInput } from "./decimal-money";

export type ApprovalPolicyInput = {
  total: DecimalInput;
  discountPct: DecimalInput;
  grossMarginPct: DecimalInput;
  customerSegment: string;
  productCategories: readonly string[];
  nonStandardTerms: boolean;
  coverageConfirmed: boolean;
  costConfirmed: boolean;
  opportunityRisk: string;
};

export type ApprovalPolicyStep = {
  code: string;
  sequence: number;
  executionMode: "SEQUENTIAL" | "PARALLEL";
  requiredPermission: string;
  assignedRoleCode?: string;
  minimumAuthority?: string;
  maximumAuthority?: string;
  makerChecker: boolean;
  slaHours?: number;
};

export type ApprovalPolicyRule = {
  code: string;
  when: Array<{
    field: keyof ApprovalPolicyInput;
    operator: "GT" | "GTE" | "LT" | "LTE" | "EQ" | "INCLUDES";
    value: string | boolean;
  }>;
  steps: ApprovalPolicyStep[];
};

export type ApprovalPolicyDefinition = {
  submissionGates?: {
    coverageRequired?: boolean;
    solutionRequired?: boolean;
    confirmedCostRequired?: boolean;
  };
  rules: ApprovalPolicyRule[];
  fallbackSteps: ApprovalPolicyStep[];
};

function matches(input: ApprovalPolicyInput, condition: ApprovalPolicyRule["when"][number]) {
  const actual = input[condition.field];
  if (condition.operator === "INCLUDES") {
    return Array.isArray(actual) && actual.includes(String(condition.value));
  }
  if (condition.operator === "EQ") return actual === condition.value;
  if (typeof actual === "boolean" || typeof condition.value === "boolean") return false;
  const left = decimal(actual as DecimalInput);
  const right = decimal(condition.value as string);
  if (condition.operator === "GT") return left.gt(right);
  if (condition.operator === "GTE") return left.gte(right);
  if (condition.operator === "LT") return left.lt(right);
  return left.lte(right);
}

export function evaluateApprovalPolicy(
  definition: ApprovalPolicyDefinition,
  input: ApprovalPolicyInput,
) {
  const matchedRules = definition.rules.filter((rule) =>
    rule.when.every((condition) => matches(input, condition)),
  );
  const sourceSteps = matchedRules.length
    ? matchedRules.flatMap((rule) => rule.steps)
    : definition.fallbackSteps;
  const unique = new Map<string, ApprovalPolicyStep>();
  for (const step of sourceSteps) {
    const current = unique.get(step.code);
    if (!current || step.sequence > current.sequence) unique.set(step.code, step);
  }
  return {
    matchedRuleCodes: matchedRules.map((rule) => rule.code),
    steps: [...unique.values()].sort((a, b) => a.sequence - b.sequence || a.code.localeCompare(b.code)),
  };
}

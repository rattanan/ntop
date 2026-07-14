import { describe, expect, it } from "vitest";

import { evaluateApprovalPolicy, type ApprovalPolicyDefinition } from "../../lib/commercial/approval-policy-evaluator";

const policy: ApprovalPolicyDefinition = {
  rules: [{
    code: "configured-high-value",
    when: [{ field: "total", operator: "GT", value: "10000000" }],
    steps: [{ code: "sales-director", sequence: 1, executionMode: "PARALLEL", requiredPermission: "approval.sales-director", makerChecker: true }, { code: "pricing", sequence: 1, executionMode: "PARALLEL", requiredPermission: "approval.pricing", makerChecker: true }],
  }],
  fallbackSteps: [{ code: "manager", sequence: 1, executionMode: "SEQUENTIAL", requiredPermission: "approval.manager", makerChecker: true }],
};
const input = { total: "12000000", discountPct: "0", grossMarginPct: "20", customerSegment: "B1", productCategories: ["Network"], nonStandardTerms: false, coverageConfirmed: true, costConfirmed: true, opportunityRisk: "NONE" };

describe("evaluateApprovalPolicy", () => {
  it("routes from versioned definition without hard-coded tier logic", () => {
    expect(evaluateApprovalPolicy(policy, input)).toMatchObject({ matchedRuleCodes: ["configured-high-value"], steps: [{ code: "pricing" }, { code: "sales-director" }] });
  });
});

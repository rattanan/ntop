import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Approval Control Center contract", () => {
  it("adds expand-only central configuration with every known workflow disabled", () => {
    const schema = read("prisma/schema.prisma");
    const migration = read("prisma/migrations/20260825190000_add_central_approval_control/migration.sql");
    expect(schema).toContain("model ApprovalSystemConfiguration");
    expect(schema).toContain("model ApprovalWorkflowConfiguration");
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(migration).toContain("'approval_system','DISABLED'");
    for (const code of ["QUOTE_APPROVAL", "PROPOSAL_APPROVAL", "SOLUTION_TECHNICAL_REVIEW", "SOLUTION_COMMERCIAL_APPROVAL", "SITE_SURVEY_RESULT_APPROVAL", "BOQ_APPROVAL", "CONTRACT_APPROVAL"]) {
      expect(migration).toContain(`'${code}'`);
    }
    expect(migration.match(/'DISABLED'/g)?.length).toBeGreaterThanOrEqual(8);
  });

  it("centralizes modes, amount tiers and authority grants on one administration page", () => {
    const page = read("app/(portal)/admin/workflow/page.tsx");
    expect(page).toContain("Approval Control Center");
    expect(page).toContain("updateApprovalSystemMode");
    expect(page).toContain("updateApprovalWorkflowMode");
    expect(page).toContain("createAmountApprovalPolicy");
    expect(page).toContain("createAuthorityGrant");
    expect(page).toContain("deactivateAuthorityGrant");
    expect(read("app/(portal)/admin/organization/page.tsx")).not.toContain("AssignOrganizationApproverForm");
  });

  it("enforces server-side gates except for the explicitly independent Contract lifecycle", () => {
    const proposal = read("lib/proposal/proposal-service.ts");
    const contract = read("lib/contract/contract-service.ts");
    const presales = read("lib/solution-design/solution-design-service.ts");
    const quote = read("lib/commercial/quote-runtime.ts");
    expect(proposal).toContain("PROPOSAL_APPROVAL");
    expect(contract).not.toContain("CONTRACT_APPROVAL");
    for (const code of ["SOLUTION_TECHNICAL_REVIEW", "SOLUTION_COMMERCIAL_APPROVAL", "SITE_SURVEY_RESULT_APPROVAL", "BOQ_APPROVAL"]) expect(presales).toContain(code);
    expect(quote).toContain('isApprovalWorkflowEnforced("QUOTE_APPROVAL")');
  });
});

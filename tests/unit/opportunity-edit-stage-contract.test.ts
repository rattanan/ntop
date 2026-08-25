import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const forms = readFileSync("components/forms.tsx", "utf8");
const detail = readFileSync("app/(portal)/opportunities/[id]/page.tsx", "utf8");
const edit = readFileSync("app/(portal)/opportunities/[id]/edit/page.tsx", "utf8");
const action = readFileSync("app/actions/opportunity.ts", "utf8");
const workflowForms = readFileSync("components/workflow-forms.tsx", "utf8");

describe("Opportunity edit stage contract", () => {
  it("does not present stage as a directly editable profile field", () => {
    expect(forms).not.toContain('name="stage"');
    expect(forms).toContain('aria-label="ขั้นตอนขายปัจจุบัน"');
    expect(forms).toContain("ขั้นตอนขายเปลี่ยนผ่าน Transition");
  });

  it("links profile editing to the governed transition workflow", () => {
    expect(forms).toContain("#stage-transition");
    expect(detail).toContain('id="stage-transition"');
    expect(action).toContain("createOpportunityRuntime().transition");
    expect(action).toContain('text(form, "idempotencyKey")');
  });

  it("collects every editable evidence field required by early-stage policies", () => {
    for (const field of ["qualificationResult", "nextAction", "requirements", "stakeholderSummary", "expectedCloseAt"]) {
      expect(forms).toContain(`name="${field}"`);
    }
    expect(edit).toContain("qualificationResult: opportunity.qualificationResult");
    expect(edit).toContain("stakeholderSummary: opportunity.stakeholderSummary");
  });

  it("offers only active configured routes and explains missing evidence in Thai", () => {
    expect(detail).toContain("opportunityTransitionPolicyVersion.findMany");
    expect(detail).toContain("effectiveFrom:{lte:policyAt}");
    expect(workflowForms).toContain("แสดงเฉพาะ Transition Policy ที่เปิดใช้งาน");
    expect(workflowForms).not.toContain('name="targetStage" required><select');
    expect(action).toContain("error.missingFields.map");
    expect(action).toContain("ยังเปลี่ยนขั้นตอนขายไม่ได้");
  });
});

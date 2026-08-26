import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const forms = readFileSync("components/forms.tsx", "utf8");
const detail = readFileSync("app/(portal)/opportunities/[id]/page.tsx", "utf8");
const edit = readFileSync("app/(portal)/opportunities/[id]/edit/page.tsx", "utf8");
const action = readFileSync("app/actions/opportunity.ts", "utf8");
const workflowForms = readFileSync("components/workflow-forms.tsx", "utf8");
const relatedRoute = readFileSync("app/api/v1/opportunities/[id]/[collection]/route.ts", "utf8");

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

  it("offers every distinct target stage without a configured route lookup", () => {
    expect(detail).toContain("STAGES.filter(([stage]) => stage !== opportunity.stage)");
    expect(detail).not.toContain("opportunityTransitionPolicyVersion.findMany");
    expect(workflowForms).toContain("เลือกเปลี่ยนไปยังขั้นตอนใดก็ได้ โดยไม่จำกัดเส้นทาง");
    expect(workflowForms).toContain('name="targetStage" value={targetStage}');
    expect(workflowForms).not.toContain("Transition Policy ที่เปิดใช้งาน");
    expect(action).toContain("error.missingFields.map");
    expect(action).toContain("ยังเปลี่ยนขั้นตอนขายไม่ได้");
  });

  it("derives the command on the server and retains terminal details plus audit guidance", () => {
    const service = readFileSync("lib/opportunity/opportunity-service.ts", "utf8");
    expect(service).toContain("opportunityTransitionCommand(current.stage, input.targetStage)");
    expect(service).toContain('transitionMode: "UNRESTRICTED_STAGE_SELECTION"');
    expect(workflowForms).toContain('targetStage==="LOST"');
    expect(workflowForms).toContain('targetStage==="CANCELLED"');
    expect(workflowForms).toContain("บันทึกประวัติพร้อม Audit ทุกครั้ง");
    expect(relatedRoute).toContain("revalidatePath(`/opportunities/${id}`)");
  });

  it("collects one visible reason for Lost while retaining the domain transition contract", () => {
    expect(workflowForms).toContain('label={targetStage==="LOST"?"เหตุผลที่ Lost":"เหตุผล"}');
    expect(workflowForms).not.toContain('name="lostReason"');
    expect(action).toContain('lostReason: targetStage === "LOST" ? reason : undefined');
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("sales conversion usability contract", () => {
  it("exposes a prominent Prospect to Lead dialog with a contact fallback", () => {
    const page = read("app/(portal)/prospects/[id]/page.tsx");
    const actions = read("components/prospect-primary-actions.tsx");

    expect(page).toContain("<ProspectConvertAction");
    expect(actions).toContain("Convert to Lead");
    expect(actions).toContain("Prospect นี้ยังไม่มี Contact");
    expect(actions).toContain("ข้อมูลที่กรอกไว้จะยังคงอยู่");
    expect(actions).toContain('/api/v1/prospects/${id}/contacts');
    expect(actions).toContain('/api/v1/prospects/${id}/convert');
  });

  it("assigns the Prospect owner from the inline pencil dialog instead of a bottom card", () => {
    const page = read("app/(portal)/prospects/[id]/page.tsx");
    const actions = read("components/prospect-primary-actions.tsx");

    expect(page).toContain("<ProspectOwnerAction");
    expect(page).not.toContain("<ProspectActionForms");
    expect(actions).toContain('aria-label="Assign Owner"');
    expect(actions).toContain("accessRetained === false");
  });

  it("prefills Lead conversion data and exposes links to downstream records", () => {
    const page = read("app/(portal)/leads/[id]/page.tsx");
    const actions = read("components/lead-detail-actions.tsx");

    expect(page).toContain("<LeadConversionActions");
    expect(page).toContain("เปิด Customer");
    expect(page).toContain("เปิด Opportunity");
    expect(actions).toContain('defaultValue={lead.taxId??""}');
    expect(actions).toContain('defaultValue={lead.estimatedBudget??""}');
    expect(actions).toContain("requirementSummary:string|null");
    expect(actions).toContain("router.push(state.redirectTo!)");
    expect(actions).toContain("event.preventDefault()");
    expect(actions).toContain("startTransition(()=>action(formData))");
    expect(actions).not.toContain('<form action={action} className="dialog-form"><input type="hidden" name="idempotencyKey" value={key}/><input type="hidden" name="conversionMode"');
  });

  it("carries the qualified requirement summary into the Opportunity", () => {
    const repository = read("lib/lead/prisma-lead-repository.ts");

    expect(repository).toContain("const opportunityRequirements = [input.lead.requirementSummary, input.lead.notes]");
    expect(repository).toContain("requirements: opportunityRequirements");
    expect(repository).toContain("sourceLeadId: input.lead.id");
  });
});

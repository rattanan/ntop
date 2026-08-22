import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("sales conversion usability contract", () => {
  it("exposes a prominent Prospect to Lead action and transfer preview", () => {
    const page = read("app/(portal)/prospects/[id]/page.tsx");
    const forms = read("components/prospect-action-forms.tsx");

    expect(page).toContain('href="#prospect-conversion"');
    expect(page).toContain("สร้าง Lead จากข้อมูลนี้");
    expect(forms).toContain('id="prospect-conversion"');
    expect(forms).toContain("ตรวจสอบข้อมูลที่จะนำไปใช้ต่อก่อนยืนยัน");
    expect(forms).toContain("Prospect เดิมและประวัติยังคงอยู่");
  });

  it("prefills Lead conversion data and exposes links to downstream records", () => {
    const page = read("app/(portal)/leads/[id]/page.tsx");
    const forms = read("components/lead-workflow-forms.tsx");

    expect(page).toContain('href="#lead-conversion"');
    expect(page).toContain("เปิด Customer");
    expect(page).toContain("เปิด Opportunity");
    expect(forms).toContain('defaultValue={lead.taxId??""}');
    expect(forms).toContain('defaultValue={lead.estimatedBudget??""}');
    expect(forms).toContain("lead.requirementSummary");
  });

  it("carries the qualified requirement summary into the Opportunity", () => {
    const repository = read("lib/lead/prisma-lead-repository.ts");

    expect(repository).toContain("const opportunityRequirements = [input.lead.requirementSummary, input.lead.notes]");
    expect(repository).toContain("requirements: opportunityRequirements");
    expect(repository).toContain("sourceLeadId: input.lead.id");
  });
});

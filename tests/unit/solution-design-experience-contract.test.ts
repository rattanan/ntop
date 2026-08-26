import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read=(path:string)=>readFileSync(resolve(process.cwd(),path),"utf8");

describe("Solution Design experience contract",()=>{
  it("carries the Opportunity into Solution Design and uses one searchable selector across create flows",()=>{
    expect(read("app/(portal)/opportunities/[id]/page.tsx")).toContain("/solution-designs?opportunityId=${id}");
    expect(read("app/(portal)/solution-designs/page.tsx")).toContain("initialOpportunityId={initialOpportunityId}");
    expect(read("components/presales-forms.tsx")).toContain("<SearchableOptionSelect name=\"opportunityId\"");
    expect(read("components/proposal-forms.tsx")).toContain("<SearchableOptionSelect name=\"opportunityId\"");
    expect(read("components/workflow-forms.tsx")).toContain("<SearchableOptionSelect id=\"opportunityId\"");
    const selector=read("components/searchable-option-select.tsx");
    expect(selector).toContain('role="combobox"');
    expect(selector).toContain('type="hidden" name={name} value={selectedId}');
  });

  it("keeps editable Solution fields versioned and allows direct configured status selection",()=>{
    expect(read("app/(portal)/solution-designs/[id]/page.tsx")).toContain(`/edit`);
    expect(read("app/api/v1/solution-designs/[id]/route.ts")).toContain("export async function PATCH");
    expect(read("components/solution-design-edit-form.tsx")).toContain('name="statusCode"');
    const service=read("lib/solution-design/solution-design-service.ts");
    expect(service).toContain('action:"solution-design.update"');
    expect(service).toContain("solutionDesignVersion.create");
    expect(service).toContain('entityType:"SOLUTION_DESIGN",code:statusCode,active:true');
    expect(read("app/(portal)/solution-designs/[id]/page.tsx")).not.toContain("SolutionWorkflowForm");
    expect(read("app/(portal)/solution-designs/[id]/page.tsx")).not.toContain("Advance Solution Design");
    expect(read("components/presales-forms.tsx")).not.toContain("Advance Solution Design");
  });

  it("keeps Product and Service addition available in every Solution status",()=>{
    const service=read("lib/solution-design/solution-design-service.ts");
    const addService=service.slice(service.indexOf("export async function addSolutionService"),service.indexOf("export async function overrideSurveyRequirement"));
    expect(addService).not.toContain("PresalesImmutableError");
    expect(read("app/(portal)/solution-designs/[id]/page.tsx")).toContain("<AddServiceForm");
  });

  it("uses admin-managed options for Solution category, Component type and Risk fields",()=>{
    const schema=read("prisma/schema.prisma");
    const seed=read("prisma/seed.ts");
    const form=read("components/presales-forms.tsx");
    expect(schema).toContain("model SolutionReferenceOption");
    expect(seed).toContain("SOLUTION_CATEGORY:");
    expect(seed).toContain("COMPONENT_TYPE:");
    expect(seed).toContain("RISK_PROBABILITY:");
    expect(form).toContain('name="componentType"');
    expect(form).toContain('select("probability","Probability"');
    expect(read("components/solution-reference-admin-console.tsx")).toContain('<table className="table">');
  });
});

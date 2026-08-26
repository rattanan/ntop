import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe,expect,it } from "vitest";
import { shouldCollapseText } from "../../components/expandable-text-assistance";

const read=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");

describe("Lead experience alignment",()=>{
  it("uses the shared Prospect classification and address fields in Lead create/edit",()=>{
    const fields=read("components/lead-form-fields.tsx"),schema=read("prisma/schema.prisma"),conversion=read("lib/prospect/prospect-service.ts");
    for(const name of ["customerType","segment","subIndustry","companySize","numberOfEmployees","address","province","currentTelecomProvider","requirementSummary","expectedPurchaseAt"]){expect(fields).toContain(`name=\"${name}\"`);expect(schema).toContain(name);}
    expect(conversion).toContain("segment: prospect.organizationType");
    expect(conversion).toContain("province: prospect.province");
    expect(conversion).toContain("estimatedBudget: prospect.estimatedOpportunityValue ?? prospect.expectedBudget");
  });

  it("carries document links forward without duplicating SalesDocument rows",()=>{
    const service=read("lib/prospect/prospect-service.ts"),detail=read("app/(portal)/leads/[id]/page.tsx"),documents=read("lib/lead/lead-document-service.ts");
    expect(service).toContain("tx.salesDocument.updateMany");
    expect(service).toContain("data: { leadId: lead.id }");
    expect(detail).toContain("salesDocuments:{where:{deletedAt:null}");
    expect(detail).toContain("<LeadDocumentPanel");
    expect(documents).toContain("buildLeadScopeWhere(actor.authorization)");
    expect(documents).toContain('action:"lead.document.download"');
  });

  it("uses dialogs for assignment, activity and both conversion actions",()=>{
    const detail=read("app/(portal)/leads/[id]/page.tsx"),actions=read("components/lead-detail-actions.tsx");
    expect(detail).toContain("<LeadAssignDialog");expect(detail).toContain("<LeadActivityDialog");expect(detail).toContain("<LeadConversionActions");
    expect(detail).not.toContain("<LeadAssignForm");expect(detail).not.toContain("<LeadActivityForm");expect(detail).not.toContain("<LeadConvertForm");
    expect(actions).toContain('showModal()');expect(actions).toContain('open("LINK")');expect(actions).toContain('open("CREATE")');
    expect(actions).toContain("Lead นี้ยังไม่มีอีเมลหรือโทรศัพท์");
    expect(read("app/actions/lead.ts")).toContain("accessRetained ? `/leads/${id}` : \"/leads\"");
  });

  it("keeps deterministic score separate from confirmed AI insight",()=>{
    const insight=read("lib/lead/lead-insight-service.ts"),detail=read("app/(portal)/leads/[id]/page.tsx");
    expect(insight).toContain('enrichmentStatus:"READY"');expect(insight).toContain('enrichmentStatus:"CONFIRMED"');
    expect(insight).toContain("leadScoreUnchanged:true");expect(insight).toContain("temperatureUnchanged:true");
    expect(detail).toContain("0–39 Cold, 40–69 Warm, 70–100 Hot");expect(detail).toContain("lead-score-gauge");
  });

  it("seeds all Thai provinces and upgrades province inputs to searchable lists",()=>{
    const provinces=read("lib/customer/province-reference.ts"),migration=read("prisma/migrations/20260826113000_align_lead_and_add_province_reference/migration.sql"),assistance=read("components/province-input-assistance.tsx");
    expect(provinces.match(/\[\"\d{2}\",/g)).toHaveLength(77);
    expect(migration).toContain("CREATE TABLE `ProvinceReference`");
    expect(assistance).toContain('input[name=\"province\"]');expect(assistance).toContain('setAttribute("list"');
  });

  it("preserves line breaks and collapses only long display text",()=>{
    expect(shouldCollapseText("สั้น\nสองบรรทัด")).toBe(false);
    expect(shouldCollapseText("หนึ่ง\nสอง\nสาม\nสี่\nห้า")).toBe(true);
    expect(shouldCollapseText("ก".repeat(221))).toBe(true);
  });
});

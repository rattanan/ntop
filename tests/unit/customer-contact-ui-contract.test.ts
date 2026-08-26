import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const detail=readFileSync(join(process.cwd(),"app/(portal)/customers/[id]/page.tsx"),"utf8");
const edit=readFileSync(join(process.cwd(),"app/(portal)/customers/[id]/edit/page.tsx"),"utf8");
const form=readFileSync(join(process.cwd(),"components/customer-contact-form.tsx"),"utf8");
const actions=readFileSync(join(process.cwd(),"app/actions/customer.ts"),"utf8");

describe("Customer contact UI contract",()=>{
  it("shows contacts read-only in Customer 360 and manages them on the edit page",()=>{expect(detail).not.toContain("<CustomerContactForm");expect(edit).toContain("เพิ่ม Contact");expect(edit).toContain("แก้ไข {contact.name}");expect(edit).toContain("customerVersion={customer.version}");});
  it("captures detailed contact fields and a stable idempotency key",()=>{for(const name of["name","title","phone","email","relationship","purpose","isPrimary"]){expect(form).toContain(`name=\"${name}\"`);}expect(form).toContain('name="idempotencyKey"');});
  it("routes contact mutations through customer application service",()=>{expect(actions).toContain("createCustomerRuntime().createContact");expect(actions).toContain("createCustomerRuntime().updateContact");});
  it("passes a plain projected value from the dedicated edit page without Prisma relations",()=>{expect(detail).not.toContain("<CustomerForm");expect(edit).toContain("const customerFormValue = {");expect(edit).toContain("<CustomerForm value={customerFormValue}");expect(edit).not.toContain("<CustomerForm value={customer}");});
  it("separates Customer 360 into compact tabs with hierarchy and duplicate governance",()=>{for(const tab of["overview","contacts","governance","sales"]){expect(detail).toContain(`tabHref(\"${tab}\")`);}expect(detail).toContain('activeTab === "governance"');expect(detail).toContain("Duplicate candidates");expect(detail).toContain("<CustomerGovernanceActions");});
  it("places sales after overview and scopes pipeline records to the exact Customer",()=>{
    expect(detail.indexOf('href={tabHref("overview")}')).toBeLessThan(detail.indexOf('href={tabHref("sales")}'));
    expect(detail.indexOf('href={tabHref("sales")}')).toBeLessThan(detail.indexOf('href={tabHref("contacts")}'));
    expect(detail).toContain("const opportunities = customer.opportunities");
    expect(detail).not.toContain("mergeAliases.flatMap");
    expect(detail).toContain("สถานะการขาย");
    expect(detail).toContain("ความครบถ้วนโปรไฟล์");
  });
  it("opens Customer lifecycle from the top action instead of rendering a lower form panel",()=>{
    const retention=readFileSync(join(process.cwd(),"components/data-retention-actions.tsx"),"utf8");
    expect(detail).toContain("customer-hero-actions");
    expect(detail).toContain("<CustomerLifecycleActions");
    expect(retention).toContain('className="record-action-dialog customer-lifecycle-dialog"');
    expect(retention).toContain('aria-label="จัดการ Customer lifecycle"');
  });
  it("offers permission-aware create actions in every sales and activity panel",()=>{
    expect(detail).toContain("PERMISSIONS.recordCreate");
    expect(detail).toContain("LEAD_CREATE_ROLES");
    for(const [label,href] of [["สร้าง Opportunity","/opportunities/new"],["สร้าง Lead","/leads/new"],["สร้างกิจกรรม","/activities/new"]]){
      expect(detail).toContain(`href=\"${href}\" aria-label=\"${label}\"`);
    }
  });
});

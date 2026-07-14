import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const detail=readFileSync(join(process.cwd(),"app/(portal)/customers/[id]/page.tsx"),"utf8");
const form=readFileSync(join(process.cwd(),"components/customer-contact-form.tsx"),"utf8");
const actions=readFileSync(join(process.cwd(),"app/actions/customer.ts"),"utf8");

describe("Customer contact UI contract",()=>{
  it("shows create and edit contact forms in Customer 360",()=>{expect(detail).toContain("เพิ่ม Contact");expect(detail).toContain("แก้ไขรายละเอียด Contact");expect(detail).toContain("customerVersion={customer.version}");});
  it("captures detailed contact fields and a stable idempotency key",()=>{for(const name of["name","title","phone","email","relationship","purpose","isPrimary"]){expect(form).toContain(`name=\"${name}\"`);}expect(form).toContain('name="idempotencyKey"');});
  it("routes contact mutations through customer application service",()=>{expect(actions).toContain("createCustomerRuntime().createContact");expect(actions).toContain("createCustomerRuntime().updateContact");});
  it("passes a plain projected value to the client form without Prisma relations",()=>{expect(detail).toContain("const customerFormValue = {");expect(detail).toContain("<CustomerForm value={customerFormValue}");expect(detail).not.toContain("<CustomerForm value={customer}");});
  it("separates Customer 360 into compact tabs with hierarchy and duplicate governance",()=>{for(const tab of["overview","contacts","governance","sales"]){expect(detail).toContain(`tabHref(\"${tab}\")`);}expect(detail).toContain('activeTab === "governance"');expect(detail).toContain("Duplicate candidates");expect(detail).toContain("<CustomerGovernanceActions");});
});

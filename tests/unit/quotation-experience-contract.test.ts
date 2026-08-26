import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read=(path:string)=>readFileSync(resolve(process.cwd(),path),"utf8");

describe("Proposal and Quotation experience contract",()=>{
  it("returns to Proposal detail after saving a new version",()=>{
    const action=read("app/actions/proposal.ts");
    expect(action).toContain("redirect(`/proposals/${proposalId}`)");
    expect(action).toContain('"digest" in error');
  });

  it("moves Proposal Status from the View workflow panel into the Edit form",()=>{
    const detail=read("app/(portal)/proposals/[id]/page.tsx");
    const edit=read("app/(portal)/proposals/[id]/edit/page.tsx");
    const form=read("components/proposal-forms.tsx");
    expect(detail).not.toContain("ProposalStatusForm");
    expect(detail).not.toContain("Next Status");
    expect(edit).toContain("proposalStatusDefinition.findMany");
    expect(edit).toContain("statuses={statuses}");
    expect(form).toContain('name="statusCode"');
    expect(form).toContain("เลือกสถานะ active ใดก็ได้โดยไม่ต้องไล่ตามลำดับ workflow");
    expect(read("app/actions/proposal.ts")).toContain('statusCode: text(form, "statusCode")');
  });

  it("keeps Product and Service selection searchable in Quotation lines",()=>{
    const form=read("components/workflow-forms.tsx");
    expect(form).toContain("<SearchableProductSelect");
    expect(form).toContain("Product / Service รายการ");
    expect(read("components/searchable-product-select.tsx")).toContain('role="combobox"');
  });

  it("renders a customer-facing Quotation with print, PDF and governed actions",()=>{
    const page=read("app/(portal)/quotes/[id]/page.tsx");
    expect(page).toContain('className="quotation-document"');
    expect(page).toContain("QuoteDocumentActions");
    expect(page).toContain("QuoteSubmitForm");
    expect(page).toContain("QuoteCommercialTransitionForm");
    expect(page).toContain("/quotes/new?quoteId=${quote.id}");
    expect(page).toContain('className="actions quote-detail-actions"');
    expect(page).toContain("Convert to Contract");
    expect(page).toContain('/contracts/new?quoteVersionId=${latest.id}');
    const actions=read("components/quote-document-actions.tsx");
    expect(actions).toContain("window.print()");
    expect(actions).toContain("ดาวน์โหลด PDF");
    expect(actions).not.toContain('className="actions quote-document-actions"');
  });

  it("edits Quote details and manual Status by creating a new immutable version",()=>{
    const page=read("app/(portal)/quotes/new/page.tsx");
    expect(page).toContain("statusOverrideEnabled={Boolean(sourceQuote)&&!approvalEnabled}");
    expect(page).toContain("ระบบจะเก็บ version เดิมเป็นหลักฐานและสร้าง version ใหม่");
    expect(read("components/workflow-forms.tsx")).toContain('name="status"');
    expect(read("components/workflow-forms.tsx")).toContain('value: "ACCEPTED"');
    expect(read("lib/commercial/prisma-quote-repository.ts")).toContain('where: { quoteId: quote.id, status: "DRAFT" }');
    expect(read("lib/commercial/prisma-quote-repository.ts")).toContain("status: versionStatus");
    expect(read("app/actions/quote.ts")).toContain("`/quotes/${resultQuoteId}`");
  });

  it("keeps Contract as a main navigation destination",()=>{
    expect(read("components/app-navigation.ts")).toContain('{ label: "สัญญา", href: "/contracts"');
  });
});

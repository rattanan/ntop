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
    const actions=read("components/quote-document-actions.tsx");
    expect(actions).toContain("window.print()");
    expect(actions).toContain("ดาวน์โหลด PDF");
  });

  it("edits Quote details by creating a new immutable version",()=>{
    const page=read("app/(portal)/quotes/new/page.tsx");
    expect(page).toContain('["DRAFT","REJECTED","RETURNED"]');
    expect(page).toContain("ระบบจะเก็บ version เดิมเป็นหลักฐานและสร้าง Draft version ใหม่");
    expect(read("lib/commercial/prisma-quote-repository.ts")).toContain('where: { quoteId: quote.id, status: "DRAFT" }');
    expect(read("app/actions/quote.ts")).toContain("`/quotes/${resultQuoteId}`");
  });

  it("keeps Contract as a main navigation destination",()=>{
    expect(read("components/app-navigation.ts")).toContain('{ label: "สัญญา", href: "/contracts"');
  });
});

import { GovernedQuoteForm } from "@/components/workflow-forms";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function NewQuote({ searchParams }: { searchParams: Promise<{ proposalId?: string; quoteId?: string }> }) {
  const session = await requireSession();
  const context = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const { proposalId, quoteId } = await searchParams;
  const [products, opportunities, proposal, sourceQuote] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, select: { id: true, name: true, code: true, listPrice: true, floorPrice: true }, orderBy: { code: "asc" } }),
    prisma.opportunity.findMany({ where: { ...buildOpportunityScopeWhere(context), stage: { notIn: ["WON", "LOST", "CANCELLED"] } }, select: { id: true, name: true, customer: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 200 }),
    proposalId ? prisma.proposal.findFirst({ where: { id: proposalId, deletedAt: null, opportunity: buildOpportunityScopeWhere(context) }, select: { id: true, opportunityId: true } }) : null,
    quoteId ? prisma.quote.findFirst({ where: { id: quoteId, OR: [{ makerId: session.id }, { opportunity: buildOpportunityScopeWhere(context) }] }, select: { id: true, proposalId: true, opportunityId: true, versions: { where: { status: { in: ["REJECTED", "RETURNED"] } }, orderBy: { versionNumber: "desc" }, take: 1, select: { validUntil: true, notes: true, subtotal: true, items: { select: { productId: true, quantity: true, unitPrice: true, discountAmount: true, lineSubtotal: true } } } } } }) : null,
  ]);
  if ((proposalId && !proposal) || (quoteId && (!sourceQuote || !sourceQuote.versions[0] || !sourceQuote.opportunityId))) notFound();
  const sourceVersion = sourceQuote?.versions[0];
  const initialLines = sourceVersion?.items.map((item) => ({ productId: item.productId, quantity: item.quantity.toFixed(4), unitPrice: item.unitPrice.toFixed(4), discountPct: item.lineSubtotal.isZero() ? "0" : item.discountAmount.div(item.lineSubtotal).mul(100).toFixed(4) }));
  return <><div className="page-head"><div><p className="eyebrow">Versioned Quotation</p><h1>{sourceQuote ? "สร้าง Quotation Revision" : "สร้างใบเสนอราคา"}</h1><p>{sourceQuote ? "สร้าง Draft version ใหม่จากรายการที่ถูก Reject/Return โดยเก็บ version เดิมเป็นหลักฐาน" : proposal ? "Quotation นี้จะเชื่อมกับ Proposal ที่เลือก" : "กรอกข้อมูล Header และเพิ่ม Product detail ได้หลายรายการ"}</p></div></div><GovernedQuoteForm quoteId={sourceQuote?.id} proposalId={sourceQuote?.proposalId ?? proposal?.id ?? undefined} initialOpportunityId={sourceQuote?.opportunityId ?? proposal?.opportunityId} initialValidUntil={sourceVersion?.validUntil?.toISOString().slice(0,10)} initialNotes={sourceVersion?.notes ?? undefined} initialLines={initialLines} products={products.map((item) => ({ id:item.id,code:item.code,name:item.name,listPrice:item.listPrice.toFixed(4),floorPrice:item.floorPrice?.toFixed(4)??null }))} opportunities={opportunities.map((item) => ({ id: item.id, name: item.name, customerName: item.customer.name }))}/></>;
}

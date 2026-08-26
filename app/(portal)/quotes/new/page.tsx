import { GovernedQuoteForm } from "@/components/workflow-forms";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { isQuoteApprovalEnabled } from "@/lib/commercial/quote-runtime";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function NewQuote({ searchParams }: { searchParams: Promise<{ proposalId?: string; quoteId?: string }> }) {
  const session = await requireSession();
  const approvalEnabled = await isQuoteApprovalEnabled();
  const context = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const { proposalId, quoteId } = await searchParams;
  const [products, opportunities, proposal, sourceQuote] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, select: { id: true, name: true, code: true, listPrice: true, floorPrice: true }, orderBy: { code: "asc" } }),
    prisma.opportunity.findMany({ where: { ...buildOpportunityScopeWhere(context), stage: { notIn: ["WON", "LOST", "CANCELLED"] } }, select: { id: true, name: true, customer: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 200 }),
    proposalId ? prisma.proposal.findFirst({ where: { id: proposalId, deletedAt: null, opportunity: buildOpportunityScopeWhere(context) }, select: { id: true, opportunityId: true } }) : null,
    quoteId ? prisma.quote.findFirst({ where: { id: quoteId, opportunity: buildOpportunityScopeWhere(context) }, select: { id: true, proposalId: true, opportunityId: true, versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { status: true, validUntil: true, notes: true, subtotal: true, items: { select: { productId: true, quantity: true, unitPrice: true, discountAmount: true, lineSubtotal: true } } } } } }) : null,
  ]);
  if ((proposalId && !proposal) || (quoteId && (!sourceQuote || !sourceQuote.versions[0] || !sourceQuote.opportunityId || !["DRAFT","REJECTED","RETURNED"].includes(sourceQuote.versions[0].status)))) notFound();
  const sourceVersion = sourceQuote?.versions[0];
  const initialLines = sourceVersion?.items.map((item) => ({ productId: item.productId, quantity: item.quantity.toFixed(4), unitPrice: item.unitPrice.toFixed(4), discountPct: item.lineSubtotal.isZero() ? "0" : item.discountAmount.div(item.lineSubtotal).mul(100).toFixed(4) }));
  return <><div className="page-head"><div><p className="eyebrow">Versioned Quotation</p><h1>{sourceQuote ? "แก้ไขรายละเอียด / สร้าง Quotation Version ใหม่" : "สร้างใบเสนอราคา"}</h1><p>{sourceQuote ? "ระบบจะเก็บ version เดิมเป็นหลักฐานและสร้าง Draft version ใหม่" : proposal ? "Quotation นี้จะเชื่อมกับ Proposal ที่เลือก" : "กรอกข้อมูล Header และเพิ่ม Product detail ได้หลายรายการ"}</p>{!approvalEnabled&&<p className="notice">Approval ถูกพักไว้ชั่วคราว การสร้างรายการนี้จะบันทึกเป็น Draft โดยไม่ต้องส่งอนุมัติ</p>}</div></div><GovernedQuoteForm quoteId={sourceQuote?.id} proposalId={sourceQuote?.proposalId ?? proposal?.id ?? undefined} initialOpportunityId={sourceQuote?.opportunityId ?? proposal?.opportunityId} initialValidUntil={sourceVersion?.validUntil?.toISOString().slice(0,10)} initialNotes={sourceVersion?.notes ?? undefined} initialLines={initialLines} products={products.map((item) => ({ id:item.id,code:item.code,name:item.name,listPrice:item.listPrice.toFixed(4),floorPrice:item.floorPrice?.toFixed(4)??null }))} opportunities={opportunities.map((item) => ({ id: item.id, name: item.name, customerName: item.customer.name }))}/></>;
}

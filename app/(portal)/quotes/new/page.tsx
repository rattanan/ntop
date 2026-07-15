import { GovernedQuoteForm } from "@/components/workflow-forms";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function NewQuote({ searchParams }: { searchParams: Promise<{ proposalId?: string }> }) {
  const session = await requireSession();
  const context = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const proposalId = (await searchParams).proposalId;
  const [products, opportunities, proposal] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, select: { id: true, name: true, code: true, listPrice: true, floorPrice: true }, orderBy: { code: "asc" } }),
    prisma.opportunity.findMany({ where: { ...buildOpportunityScopeWhere(context), stage: { notIn: ["WON", "LOST", "CANCELLED"] } }, select: { id: true, name: true, customer: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 200 }),
    proposalId ? prisma.proposal.findFirst({ where: { id: proposalId, deletedAt: null, opportunity: buildOpportunityScopeWhere(context) }, select: { id: true, opportunityId: true } }) : null,
  ]);
  if (proposalId && !proposal) notFound();
  return <><div className="page-head"><div><p className="eyebrow">Versioned Quotation</p><h1>สร้างใบเสนอราคา</h1><p>{proposal ? "Quotation นี้จะเชื่อมกับ Proposal ที่เลือก" : "กรอกข้อมูล Header และเพิ่ม Product detail ได้หลายรายการ"}</p></div></div><GovernedQuoteForm proposalId={proposal?.id} initialOpportunityId={proposal?.opportunityId} products={products.map((item) => ({ id:item.id,code:item.code,name:item.name,listPrice:item.listPrice.toFixed(4),floorPrice:item.floorPrice?.toFixed(4)??null }))} opportunities={opportunities.map((item) => ({ id: item.id, name: item.name, customerName: item.customer.name }))}/></>;
}

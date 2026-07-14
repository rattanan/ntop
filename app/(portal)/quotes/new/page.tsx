import { GovernedQuoteForm } from "@/components/workflow-forms";
import { isAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewQuote() {
  const session = await requireSession();
  const where = isAdmin(session.role) ? {} : { ownerId: session.id };
  const [products, opportunities] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, select: { id: true, name: true, code: true, listPrice: true, floorPrice: true }, orderBy: { code: "asc" } }),
    prisma.opportunity.findMany({ where: { ...where, stage: { notIn: ["WON", "LOST", "CANCELLED"] } }, select: { id: true, name: true, customer: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 200 }),
  ]);
  return <><div className="page-head"><div><p className="eyebrow">Versioned Quotation</p><h1>สร้างใบเสนอราคา</h1><p>กรอกข้อมูล Header และเพิ่ม Product detail ได้หลายรายการ</p></div></div><GovernedQuoteForm products={products.map((item) => ({ id:item.id,code:item.code,name:item.name,listPrice:item.listPrice.toFixed(4),floorPrice:item.floorPrice?.toFixed(4)??null }))} opportunities={opportunities.map((item) => ({ id: item.id, name: item.name, customerName: item.customer.name }))}/></>;
}

import { notFound } from "next/navigation";

import Link from "next/link";
import { QuoteCommercialTransitionForm, QuoteSubmitForm } from "@/components/workflow-forms";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";

export default async function QuoteDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const context = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const quote = await prisma.quote.findFirst({
    where: { id: (await params).id, OR: [{ opportunity: buildOpportunityScopeWhere(context) }, { makerId: session.id }] },
    include: { customer: true, opportunity: true, versions: { orderBy: { versionNumber: "desc" }, include: { items: true, approvalRequests: { include: { steps: true } } } } },
  });
  if (!quote) notFound();
  return <><div className="page-head"><div><p className="eyebrow">{quote.quoteNo} · {quote.customer.name}</p><h1>Quote Versions</h1></div></div>{quote.versions.map((version, index) => <section className="card" key={version.id} style={{ marginBottom: 20 }}><div className="card-header">Version {version.versionNumber} · {version.status}</div><div className="card-body"><div className="detail-grid"><div><p className="detail-label">Total</p><p className="detail-value">{version.total.toFixed(2)} {version.currency}</p></div>{session.role !== "VIEWER"&&<><div><p className="detail-label">Cost</p><p className="detail-value">{version.totalCost.toFixed(2)}</p></div><div><p className="detail-label">Margin</p><p className="detail-value">{version.grossMarginPct.toFixed(4)}%</p></div></>}</div><ul>{version.items.map((item)=><li key={item.id}>{item.productCode} — {item.productName} × {item.quantity.toFixed(4)} = {item.lineTotal.toFixed(2)}</li>)}</ul>{version.status === "DRAFT" && session.role !== "VIEWER" && <QuoteSubmitForm quoteId={quote.id} quoteVersionId={version.id}/>} {session.role !== "VIEWER" && index === 0 && (version.status === "REJECTED" || version.status === "RETURNED") && <Link className="primary" href={`/quotes/new?quoteId=${quote.id}`}>สร้าง Revision และส่งใหม่</Link>} {session.role !== "VIEWER" && (version.status === "APPROVED" || version.status === "SENT") && <QuoteCommercialTransitionForm quoteId={quote.id} quoteVersionId={version.id} status={version.status}/>} {version.status === "ACCEPTED" && <Link className="primary" href={`/contracts/new?quoteVersionId=${version.id}`}>สร้าง Contract</Link>} {version.approvalRequests.map((request)=><p key={request.id}><a className="link" href={`/approvals/${request.id}`}>Approval {request.status} →</a></p>)}</div></section>)}{!quote.versions.length&&<section className="card"><div className="card-body">Legacy quote นี้ยังอ่านได้ แต่ยังไม่มี governed version</div></section>}</>;
}

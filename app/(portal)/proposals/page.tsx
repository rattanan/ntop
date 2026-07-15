import Link from "next/link";

import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { assertPermission, PERMISSIONS } from "@/lib/authorization/permission-policy";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";

const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" });

export default async function ProposalsPage() {
  const session = await requireSession(); assertPermission(session, PERMISSIONS.proposalView);
  const context = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const [proposals, statuses] = await Promise.all([
    prisma.proposal.findMany({ where: { deletedAt: null, OR: [{ ownerId: session.id }, { opportunity: buildOpportunityScopeWhere(context) }] }, include: { customer: { select: { name: true } }, opportunity: { select: { name: true } }, owner: { select: { name: true } }, status: true, quotes: { include: { versions: { take: 1, orderBy: { versionNumber: "desc" }, select: { total: true } } } } }, orderBy: { updatedAt: "desc" }, take: 200 }),
    prisma.proposalStatusDefinition.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const count = new Map(statuses.map((status)=>[status.code,proposals.filter((proposal)=>proposal.statusCode===status.code).length]));
  const quotationValue = proposals.reduce((sum,proposal)=>sum+proposal.quotes.reduce((quoteSum,quote)=>quoteSum+(quote.versions[0]?.total.toNumber()??0),0),0);
  const accepted = proposals.filter((item)=>item.status.reportingCategory==="ACCEPTED").length;
  const decided = proposals.filter((item)=>["ACCEPTED","REJECTED"].includes(item.status.reportingCategory)).length;
  const maxCount = Math.max(1,...count.values());
  return <><div className="page-head proposal-page-head"><div><p className="eyebrow">AI Sales Companion · Phase 1</p><h1>Proposal &amp; Quotation</h1><p>สร้างข้อเสนอแบบ versioned เชื่อม Opportunity, Customer, Product และ Approval</p></div>{session.role!=="VIEWER"&&<Link href="/proposals/new" className="primary">+ New Proposal</Link>}</div>
    <section className="proposal-kpis"><article><span>Proposals</span><strong>{proposals.length}</strong><small>bounded latest 200</small></article><article><span>Quotation Value</span><strong>{money.format(quotationValue)}</strong><small>linked latest versions</small></article><article><span>Acceptance Rate</span><strong>{decided?Math.round(accepted/decided*100):0}%</strong><small>{accepted} accepted / {decided} decided</small></article><article><span>Pending Work</span><strong>{proposals.filter((item)=>!item.status.terminal).length}</strong><small>non-terminal proposals</small></article></section>
    <div className="proposal-dashboard-grid"><section className="card"><div className="card-header"><strong>Proposal Status</strong></div><div className="card-body status-chart">{statuses.map((status)=><div key={status.code}><span>{status.label}</span><div><i style={{width:`${(count.get(status.code)??0)/maxCount*100}%`}}/></div><strong>{count.get(status.code)??0}</strong></div>)}</div></section><section className="card"><div className="card-header"><strong>Workflow Snapshot</strong></div><div className="card-body proposal-status-cards">{statuses.map((status)=><div key={status.code}><span className="status-dot"/><span>{status.label}</span><strong>{count.get(status.code)??0}</strong></div>)}</div></section></div>
    <section className="card"><div className="card-header"><strong>Recent Proposals</strong><span className="badge muted">{proposals.length} records</span></div><div className="table-wrap"><table className="table"><thead><tr><th>Proposal No</th><th>Proposal / Opportunity</th><th>Customer</th><th>Owner</th><th>Version</th><th>Expire</th><th>Status</th></tr></thead><tbody>{proposals.map((proposal)=><tr key={proposal.id}><td><Link className="link" href={`/proposals/${proposal.id}`}>{proposal.proposalNo}</Link></td><td><strong>{proposal.name}</strong><small className="table-subtext">{proposal.opportunity.name}</small></td><td>{proposal.customer.name}</td><td>{proposal.owner.name}</td><td>v{proposal.version}</td><td>{proposal.expireDate?date.format(proposal.expireDate):"—"}</td><td><span className="badge">{proposal.status.label}</span></td></tr>)}</tbody></table>{!proposals.length&&<div className="empty">ยังไม่มี Proposal — เริ่มจาก Opportunity ที่อยู่ใน scope ของคุณ</div>}</div></section>
  </>;
}

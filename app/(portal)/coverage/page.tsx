import Link from "next/link";

import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { formatCount, formatMoney } from "@/lib/number-format";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";

export default async function Coverage() {
  const session = await requireSession();
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const checks = await prisma.coverageCheck.findMany({ where: { opportunity: buildOpportunityScopeWhere(authorization) }, include: { opportunity: { include: { customer: true } } }, orderBy: { createdAt: "desc" } });
  return <>
    <div className="page-head"><div><p className="eyebrow">Pre-sale Gate</p><h1>Coverage / Feasibility</h1></div>{session.role !== "VIEWER" && <Link className="primary" href="/coverage/new">สร้างคำขอ</Link>}</div>
    <section className="card"><div className="table-wrap"><table className="table"><thead><tr><th>Opportunity</th><th>Customer</th><th>วงจร</th><th>สถานะ</th><th>ต้นทุนยืนยัน</th></tr></thead><tbody>{checks.map((check) => <tr key={check.id}><td>{check.opportunity.name}</td><td>{check.opportunity.customer.name}</td><td>{formatCount(check.circuitCount)}</td><td><span className="badge">{check.status}</span></td><td>{check.confirmedCost !== null ? formatMoney(check.confirmedCost, "THB") : "รอตรวจสอบ"}</td></tr>)}</tbody></table>{!checks.length && <div className="empty">ยังไม่มีคำขอ coverage</div>}</div></section>
  </>;
}

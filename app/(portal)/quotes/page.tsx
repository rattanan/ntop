import Link from "next/link";

import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";

export default async function Quotes() {
  const session = await requireSession();
  const context = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const quotes = await prisma.quote.findMany({ where: { OR: [{ opportunity: buildOpportunityScopeWhere(context) }, { makerId: session.id }] }, include: { customer: true, versions: { orderBy: { versionNumber: "desc" }, take: 1 } }, orderBy: { createdAt: "desc" }, take: 200 });
  return <><div className="page-head"><div><p className="eyebrow">Versioned Quotation</p><h1>ใบเสนอราคา</h1></div>{session.role!=="VIEWER"&&<Link href="/quotes/new" className="primary">สร้างใบเสนอราคา</Link>}</div><section className="card"><div className="table-wrap"><table className="table"><thead><tr><th>เลขที่</th><th>ลูกค้า</th><th>Version</th><th>ยอดรวม</th><th>สถานะ</th></tr></thead><tbody>{quotes.map((quote) => { const version = quote.versions[0]; return <tr key={quote.id}><td><Link className="link" href={`/quotes/${quote.id}`}>{quote.quoteNo}</Link></td><td>{quote.customer.name}</td><td>{version ? `v${version.versionNumber}` : "Legacy"}</td><td>{(version?.total ?? quote.total).toFixed(2)} THB</td><td><span className="badge">{version?.status ?? quote.status}</span></td></tr>; })}</tbody></table>{!quotes.length&&<div className="empty">ยังไม่มีใบเสนอราคา</div>}</div></section></>;
}

import { notFound } from "next/navigation";

import { BoqCommandForms } from "@/components/presales-forms";
import { isApprovalWorkflowEnforced } from "@/lib/approval/approval-control";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { formatCount, formatDecimal, formatMoney } from "@/lib/number-format";
import { prisma } from "@/lib/prisma";
import { getBoq, PresalesAccessError } from "@/lib/solution-design/solution-design-service";

export default async function BoqDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const approvalEnabled = await isApprovalWorkflowEnforced("BOQ_APPROVAL");
  let boq;
  try { boq = await getBoq({ ...session, authorization }, id); }
  catch (error) { if (error instanceof PresalesAccessError) notFound(); throw error; }
  const sections = await prisma.boqSection.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { displayOrder: "asc" } });

  return <>
    <div className="page-head"><div><p className="eyebrow">{boq.boqNumber}</p><h1>BOQ Version {boq.version}.{boq.revisionNumber}</h1><p>Pricing date {boq.pricingDate.toLocaleDateString("th-TH")}</p></div><span className="badge">{boq.statusCode}</span></div>
    <section className="presales-kpis">
      <article className="card"><span>Total contract value</span><strong>{formatMoney(boq.totalContractValue, boq.currency)}</strong></article>
      <article className="card"><span>Total cost</span><strong>{boq.totalCost !== null ? formatMoney(boq.totalCost, boq.currency) : "Restricted"}</strong></article>
      <article className="card"><span>Gross margin</span><strong>{boq.grossMarginPercent !== null ? `${formatDecimal(boq.grossMarginPercent, 2)}%` : "Restricted"}</strong></article>
    </section>
    <section className="card"><div className="table-wrap"><table className="table"><thead><tr><th>Line</th><th>Item</th><th>Source</th><th>Qty</th><th>Charge</th><th>Cost</th><th>Selling</th></tr></thead><tbody>{boq.items.map((item) => <tr key={item.id}><td>{item.lineNumber}</td><td>{item.itemName}<br /><small>{item.provisionalPricing ? "Provisional pricing" : "Confirmed"}</small></td><td>{item.sourceType}</td><td>{formatCount(item.finalQuantity)} {item.unit}</td><td>{item.chargeType}</td><td>{item.totalCost !== null ? formatMoney(item.totalCost, boq.currency) : "Restricted"}</td><td>{formatMoney(item.totalSellingPrice, boq.currency)}</td></tr>)}</tbody></table></div></section>
    <BoqCommandForms boqId={id} status={boq.statusCode} sections={sections} approvalEnabled={approvalEnabled} />
    <section className="card"><div className="card-header"><strong>Version History</strong></div><div className="card-body timeline-list">{boq.versions.map((version) => <div className="timeline" key={version.id}><strong>{version.version}.{version.revisionNumber} · {version.statusCode}</strong><p>{version.changeReason ?? "Initial snapshot"}</p><small>{version.createdAt.toLocaleString("th-TH")}</small></div>)}</div></section>
  </>;
}

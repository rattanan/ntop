import { notFound } from "next/navigation";

import { ApprovalDecisionForm } from "@/components/workflow-forms";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";

export default async function ApprovalDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const context = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const request = await prisma.approvalRequest.findFirst({ where: { id: (await params).id, quoteVersion: { quote: { opportunity: buildOpportunityScopeWhere(context) } } }, include: { quoteVersion: { include: { quote: true } }, policyVersion: true, steps: { orderBy: [{ sequence: "asc" }, { stepCode: "asc" }] }, decisions: { orderBy: { decidedAt: "asc" } } } });
  if (!request) notFound();
  const actionable = request.steps.find((step)=>["PENDING","ESCALATED","DELEGATED"].includes(step.status));
  return <><div className="page-head"><div><p className="eyebrow">{request.quoteVersion.quote.quoteNo} · version {request.quoteVersion.versionNumber}</p><h1>Approval {request.status}</h1></div></div><section className="card"><div className="card-body"><p>Policy version: {request.policyVersion.version} · hash {request.quoteVersionHash}</p><ol>{request.steps.map((step)=><li key={step.id}>{step.stepCode} — {step.status} ({step.requiredPermission})</li>)}</ol><h3>Decision evidence</h3><ul>{request.decisions.map((decision)=><li key={decision.id}>{decision.decision} by {decision.actorId} at {decision.decidedAt.toISOString()} — {decision.reason}</li>)}</ul></div></section>{actionable&&<section style={{marginTop:20}}><ApprovalDecisionForm requestId={request.id} stepId={actionable.id} version={request.version}/></section>}</>;
}

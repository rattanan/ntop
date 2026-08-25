import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";
import { isApprovalWorkflowEnforced } from "@/lib/approval/approval-control";

export default async function ApprovalsPage() {
  const session = await requireSession();
  const context = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const [requests, approvalEnabled] = await Promise.all([prisma.approvalRequest.findMany({ where: { quoteVersion: { quote: { opportunity: buildOpportunityScopeWhere(context) } } }, include: { quoteVersion: { include: { quote: true } }, steps: true }, orderBy: { submittedAt: "desc" }, take: 200 }), isApprovalWorkflowEnforced("QUOTE_APPROVAL")]);
  return <><div className="page-head"><div><p className="eyebrow">Configurable Approval</p><h1>Approval Requests</h1></div></div>{!approvalEnabled&&<p className="notice">Quotation Approval ถูกพักไว้ รายการเดิมยังเปิดดูเป็นหลักฐานได้ แต่ไม่สามารถบันทึกคำตัดสินใหม่ได้</p>}<section className="card"><div className="table-wrap"><table className="table"><thead><tr><th>Quote</th><th>Version</th><th>Status</th><th>Pending step</th></tr></thead><tbody>{requests.map((request)=><tr key={request.id}><td><a className="link" href={`/approvals/${request.id}`}>{request.quoteVersion.quote.quoteNo}</a></td><td>{request.quoteVersion.versionNumber}</td><td>{request.status}</td><td>{request.steps.filter((step)=>step.status==="PENDING"||step.status==="ESCALATED").map((step)=>step.stepCode).join(", ")||"—"}</td></tr>)}</tbody></table></div></section></>;
}

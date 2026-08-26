import { notFound } from "next/navigation";

import { ResultActions, SurveyCommandForms, SurveyResultForm } from "@/components/presales-forms";
import { isApprovalWorkflowEnforced } from "@/lib/approval/approval-control";
import { requireSession } from "@/lib/auth";
import { authorizedOrganizationUnitIds, buildAuthorizedUserWhere, loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { formatCount, formatMoney } from "@/lib/number-format";
import { prisma } from "@/lib/prisma";
import { getSiteSurvey, PresalesAccessError } from "@/lib/solution-design/solution-design-service";

export default async function SiteSurveyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const approvalEnabled = await isApprovalWorkflowEnforced("SITE_SURVEY_RESULT_APPROVAL");
  let survey;
  try { survey = await getSiteSurvey({ ...session, authorization }, id); }
  catch (error) { if (error instanceof PresalesAccessError) notFound(); throw error; }
  const [users, organizationUnits] = await Promise.all([
    prisma.user.findMany({ where: buildAuthorizedUserWhere(authorization), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.organizationUnit.findMany({ where: { active: true, id: { in: authorizedOrganizationUnitIds(authorization) } }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
  ]);

  return <>
    <div className="page-head"><div><p className="eyebrow">{survey.surveyRequestNumber}</p><h1>{survey.site?.siteName ?? "Site Survey"}</h1><p>Integration Mode: {survey.integrationMode} · Provider: {survey.integrationProvider}</p></div><span className="badge">{survey.statusCode}</span></div>
    <section className="presales-kpis"><article className="card"><span>Priority</span><strong>{survey.priority}</strong></article><article className="card"><span>Scheduled</span><strong>{survey.scheduledSurveyDate?.toLocaleDateString("th-TH") ?? "—"}</strong></article><article className="card"><span>Result revisions</span><strong>{formatCount(survey.results.length)}</strong></article></section>
    <section className="card"><div className="card-header"><strong>Installation Site &amp; GPS</strong></div><div className="card-body detail-grid"><div><span>Address</span><strong>{survey.site?.addressLine1}, {survey.site?.district}, {survey.site?.province}</strong></div><div><span>Coordinates</span><strong>{survey.site?.latitude.toString()}, {survey.site?.longitude.toString()}</strong></div><div><span>Contacts</span><strong>{survey.contacts.map((contact) => `${contact.fullName} · ${contact.phone}`).join(", ")}</strong></div></div></section>
    <SurveyCommandForms requestId={id} status={survey.statusCode} users={users} organizationUnits={organizationUnits} />
    {survey.statusCode === "IN_PROGRESS" && <SurveyResultForm requestId={id} />}
    <ResultActions requestId={id} status={survey.statusCode} approvalEnabled={approvalEnabled} />
    <section className="card"><div className="card-header"><strong>Survey Results</strong></div><div className="card-body related-list">{survey.results.map((result) => <article key={result.id}><strong>Revision {result.revisionNumber} · {result.feasibilityStatus}</strong><p>{result.technicalSummary}</p><small>{result.statusCode} · Source {result.resultSource}</small></article>)}</div></section>
    <section className="card"><div className="card-header"><strong>Estimated Items</strong></div><div className="table-wrap"><table className="table"><thead><tr><th>Type</th><th>Item</th><th>Qty</th><th>Estimated cost</th></tr></thead><tbody>{survey.estimatedItems.map((item) => <tr key={item.id}><td>{item.itemType}</td><td>{item.itemName}</td><td>{formatCount(item.quantity)} {item.unit}</td><td>{item.estimatedTotalCost !== null ? formatMoney(item.estimatedTotalCost, "THB") : "—"}</td></tr>)}</tbody></table></div></section>
    <section className="card"><div className="card-header"><strong>Integration History</strong></div><div className="card-body timeline-list">{survey.logs.map((log) => <div className="timeline" key={log.id}><strong>{log.provider} · {log.status}</strong><p>Schema {log.schemaVersion} · {log.direction}</p><small>{log.createdAt.toLocaleString("th-TH")}</small></div>)}</div></section>
  </>;
}

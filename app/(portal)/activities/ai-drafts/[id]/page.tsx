import { notFound } from "next/navigation";

import { MeetingDraftReviewForm } from "@/components/meeting-draft-review-form";
import { parseMeetingDraftOutput } from "@/lib/ai/meeting-draft-schema";
import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { requirePermission } from "@/lib/authorization/require-permission";
import { buildCustomerScopeWhere } from "@/lib/customer/customer-query-service";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";

export default async function MeetingDraftReviewPage({ params }: { params: Promise<{id:string}> }) {
  const actor = await requirePermission(PERMISSIONS.aiMeetingDraftConfirm);
  const { id } = await params;
  const output = await prisma.aiOutput.findFirst({ where: { id, status: "DRAFT", job: { requestedById: actor.id } }, select: { id: true, validatedOutput: true } });
  if (!output?.validatedOutput) notFound();
  let draft;
  try { draft = parseMeetingDraftOutput(output.validatedOutput); } catch { notFound(); }
  const authorization = await loadAuthorizationContext({ actorId: actor.id, legacyRole: actor.role });
  const [customers, opportunities] = await Promise.all([
    prisma.customer.findMany({ where: buildCustomerScopeWhere(authorization), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.opportunity.findMany({ where: buildOpportunityScopeWhere(authorization), select: { id: true, name: true, customerId: true }, orderBy: { name: "asc" } }),
  ]);
  return <><div className="page-head"><div><p className="eyebrow">AI Meeting Assistant</p><h1>ตรวจสอบ Meeting Draft</h1></div></div><MeetingDraftReviewForm outputId={output.id} draft={draft} customers={customers} opportunities={opportunities}/></>;
}

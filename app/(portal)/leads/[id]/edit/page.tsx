import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LeadEditForm } from "@/components/lead-workflow-forms";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS, permissionPolicy } from "@/lib/authorization/permission-policy";
import { buildCustomerScopeWhere } from "@/lib/customer/customer-query-service";
import { LEAD_CORE_UPDATE_ROLES, LEAD_TRANSITIONS } from "@/lib/lead/lead-rules";
import { buildLeadScopeWhere } from "@/lib/lead/prisma-lead-repository";
import { prisma } from "@/lib/prisma";

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const context = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const { id } = await params;
  const lead = await prisma.lead.findFirst({ where: { id, ...buildLeadScopeWhere(context) } });
  if (!lead) notFound();

  const canCoreUpdate =
    LEAD_TRANSITIONS[lead.status].length > 0 &&
    permissionPolicy.allows(session, PERMISSIONS.recordUpdate) &&
    context.assignments.some((item) => (LEAD_CORE_UPDATE_ROLES as readonly string[]).includes(item.role));
  if (!canCoreUpdate) notFound();

  const customers = await prisma.customer.findMany({
    where: { AND: [{ mergedIntoCustomerId: null }, buildCustomerScopeWhere(context)] },
    select: { id: true, name: true, taxId: true, province: true },
    orderBy: { name: "asc" },
    take: 200,
  });
  const formValue = {
    id: lead.id, version: lead.version, company: lead.company, taxId: lead.taxId,
    contactName: lead.contactName, contactEmail: lead.contactEmail, contactPhone: lead.contactPhone,
    source: lead.source, status: lead.status, score: lead.score,
    recommendedProducts: lead.recommendedProducts, requirementSummary: lead.requirementSummary,
    estimatedBudget: lead.estimatedBudget?.toString() ?? null, notes: lead.notes,
    disqualificationReason: lead.disqualificationReason, customerId: lead.customerId,
  };

  return <>
    <div className="page-head"><div>
      <Link className="back-link" href={`/leads/${id}`}><ArrowLeft aria-hidden="true" />กลับหน้ารายละเอียด</Link>
      <p className="eyebrow">Lead Management</p><h1>แก้ไข {lead.company}</h1>
    </div></div>
    <LeadEditForm lead={formValue} customers={customers} />
  </>;
}

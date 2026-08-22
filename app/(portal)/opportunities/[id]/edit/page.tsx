import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OpportunityForm } from "@/components/forms";
import { isAdmin, requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS, permissionPolicy } from "@/lib/authorization/permission-policy";
import { buildCustomerScopeWhere } from "@/lib/customer/customer-query-service";
import { getOpportunity } from "@/lib/opportunity/opportunity-query-service";
import { OpportunityAccessError } from "@/lib/opportunity/opportunity-service";
import { prisma } from "@/lib/prisma";

export default async function EditOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!permissionPolicy.allows(session, PERMISSIONS.recordUpdate)) notFound();
  const context = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const { id } = await params;
  let opportunity;
  try {
    opportunity = await getOpportunity(context, id);
  } catch (error) {
    if (error instanceof OpportunityAccessError) notFound();
    throw error;
  }

  const [customers, users] = await Promise.all([
    prisma.customer.findMany({
      where: { mergedIntoCustomerId: null, ...buildCustomerScopeWhere(context) },
      select: { id: true, name: true, taxId: true }, orderBy: { name: "asc" }, take: 500,
    }),
    isAdmin(session.role)
      ? prisma.user.findMany({
          where: { active: true }, select: { id: true, name: true, email: true },
          orderBy: { name: "asc" }, take: 500,
        })
      : Promise.resolve([]),
  ]);
  const value = {
    id: opportunity.id, version: opportunity.version, name: opportunity.name,
    customerId: opportunity.customerId, flow: opportunity.flow, stage: opportunity.stage,
    estimatedValue: opportunity.estimatedValue.toString(), probability: opportunity.probability,
    expectedCloseAt: opportunity.expectedCloseAt?.toISOString().slice(0, 10),
    ownerId: opportunity.ownerId, nextAction: opportunity.nextAction,
    requirements: opportunity.requirements, vendorAssessment: opportunity.vendorAssessment,
  };

  return <>
    <div className="page-head"><div>
      <Link className="back-link" href={`/opportunities/${id}`}><ArrowLeft aria-hidden="true" />กลับหน้ารายละเอียด</Link>
      <p className="eyebrow">Opportunity Management</p><h1>แก้ไข {opportunity.name}</h1>
    </div></div>
    <OpportunityForm value={value} customers={customers} users={users} role={session.role} />
  </>;
}

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProspectForm } from "@/components/prospect-form";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import { buildProspectScopeWhere, loadProspectPermissions } from "@/lib/prospect/prospect-authorization";
import { prisma } from "@/lib/prisma";
import { loadCustomerClassifications } from "@/lib/customer/customer-classification";

export default async function EditProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const context = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const permissions = await loadProspectPermissions(context);
  if (!permissions.has(PERMISSIONS.prospectUpdate)) notFound();

  const { id } = await params;
  const [prospect,classifications] = await Promise.all([prisma.prospect.findFirst({
    where: { id, ...buildProspectScopeWhere(context, permissions) },
    include: { contacts: { where: { deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], take: 1 } },
  }),loadCustomerClassifications()]);
  if (!prospect) notFound();
  const primaryContact = prospect.contacts[0];
  const values = {
    id: prospect.id, version: prospect.version, companyName: prospect.companyName,
    companyNameEnglish: prospect.companyNameEnglish ?? undefined, taxId: prospect.taxId ?? undefined,
    branchNumber: prospect.branchNumber ?? undefined, customerType: prospect.customerType === "B2G" || prospect.customerType === "B2B" ? prospect.customerType as "B2G" | "B2B" : undefined,
    organizationType: prospect.organizationType ?? undefined, subIndustry: prospect.subIndustry ?? undefined,
    companySize: prospect.companySize === "SMALL" || prospect.companySize === "MEDIUM" || prospect.companySize === "LARGE" ? prospect.companySize as "SMALL" | "MEDIUM" | "LARGE" : undefined, numberOfEmployees: prospect.numberOfEmployees ?? undefined,
    website: prospect.website ?? undefined, address: prospect.address ?? undefined,
    subDistrict: prospect.subDistrict ?? undefined, district: prospect.district ?? undefined,
    province: prospect.province ?? undefined, postalCode: prospect.postalCode ?? undefined,
    region: prospect.region ?? undefined, currentTelecomProvider: prospect.currentTelecomProvider ?? undefined,
    currentInternetProvider: prospect.currentInternetProvider ?? undefined,
    currentCloudProvider: prospect.currentCloudProvider ?? undefined,
    currentSecurityProvider: prospect.currentSecurityProvider ?? undefined,
    expectedBudget: prospect.expectedBudget?.toString(),
    estimatedOpportunityValue: prospect.estimatedOpportunityValue?.toString(),
    expectedPurchasePeriod: prospect.expectedPurchasePeriod ?? undefined,
    currentContractEndDate: prospect.currentContractEndDate ? prospect.currentContractEndDate.toISOString().slice(0,10) as unknown as Date : undefined,
    businessPainPoints: prospect.businessPainPoints ?? undefined,
    recommendedProducts: prospect.recommendedProducts ?? undefined,
    source: prospect.source, status: prospect.status, sourceName: prospect.sourceName ?? undefined,
    referralName: prospect.referralName ?? undefined, notes: prospect.notes ?? undefined,
    contact: primaryContact ? {
      name: primaryContact.name, position: primaryContact.position ?? undefined,
      department: primaryContact.department ?? undefined, phone: primaryContact.phone ?? undefined,
      mobile: primaryContact.mobile ?? undefined, email: primaryContact.email ?? undefined,
      lineId: primaryContact.lineId ?? undefined,
      preferredContactChannel: primaryContact.preferredContactChannel ?? undefined,
      isPrimary: primaryContact.isPrimary,
    } : undefined,
  };

  return <>
    <div className="page-head"><div>
      <Link className="back-link" href={`/prospects/${id}`}><ArrowLeft aria-hidden="true" />กลับหน้ารายละเอียด</Link>
      <p className="eyebrow">Prospect Management</p><h1>แก้ไข {prospect.companyName}</h1>
    </div></div>
    <ProspectForm prospect={values} classifications={classifications} />
  </>;
}

import { notFound } from "next/navigation";

import { DealRiskExplanationReviewForm } from "@/components/deal-risk-explanation-review-form";
import { DEAL_RISK_EXPLANATION_CAPABILITY } from "@/lib/ai/deal-risk-explanation-service";
import { parseMeetingDraftOutput } from "@/lib/ai/meeting-draft-schema";
import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import { requirePermission } from "@/lib/authorization/require-permission";
import { prisma } from "@/lib/prisma";

function opportunityIdFromSources(value: unknown) {
  if (!Array.isArray(value)) return null;
  const source = value.find(
    (item) =>
      item !== null &&
      typeof item === "object" &&
      "type" in item &&
      item.type === "OPPORTUNITY" &&
      "id" in item &&
      typeof item.id === "string",
  );
  return source && typeof source === "object" && "id" in source
    ? String(source.id)
    : null;
}

export default async function DealRiskExplanationReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePermission(PERMISSIONS.aiRiskExplain);
  const { id } = await params;
  const output = await prisma.aiOutput.findFirst({
    where: {
      id,
      status: "DRAFT",
      capability: DEAL_RISK_EXPLANATION_CAPABILITY,
      job: { requestedById: actor.id },
    },
    select: {
      validatedOutput: true,
      inputSourceReferences: true,
    },
  });
  if (!output?.validatedOutput) notFound();
  const opportunityId = opportunityIdFromSources(output.inputSourceReferences);
  if (!opportunityId) notFound();
  const opportunity = await prisma.opportunity.findFirst({
    where: {
      id: opportunityId,
      ...(actor.role === "ADMIN" ? {} : { ownerId: actor.id }),
    },
    select: {
      id: true,
      name: true,
      customerId: true,
      customer: { select: { name: true } },
    },
  });
  if (!opportunity) notFound();
  let draft;
  try {
    draft = parseMeetingDraftOutput(output.validatedOutput);
  } catch {
    notFound();
  }
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">AI Deal Risk Assistant</p>
          <h1>ตรวจสอบคำอธิบายและ Next Action</h1>
        </div>
      </div>
      <DealRiskExplanationReviewForm
        outputId={id}
        draft={draft}
        opportunity={{
          id: opportunity.id,
          name: opportunity.name,
          customerId: opportunity.customerId,
          customerName: opportunity.customer.name,
        }}
      />
    </>
  );
}

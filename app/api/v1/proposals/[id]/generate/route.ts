import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { createActiveProviderClient, AiConfigurationRuntimeError } from "@/lib/ai/provider-configuration-runtime";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";
import { PROPOSAL_AI_PROMPT_VERSION } from "@/lib/proposal/contracts";
import { ProposalAiService } from "@/lib/proposal/proposal-ai-service";
import { createProposalRuntime } from "@/lib/proposal/proposal-runtime";
import { ProposalAccessError, ProposalTerminalError, ProposalVersionConflictError } from "@/lib/proposal/proposal-service";
import { requireIdempotencyKey, workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../../../workflow-api-response";
import { proposalActor } from "../../proposal-api";

const inputSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  productIds: z.array(z.string().trim().min(1)).max(100).default([]),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = workflowCorrelationId(request); const session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  const key = requireIdempotencyKey(request, correlationId); if (typeof key !== "string") return key;
  try {
    const input = inputSchema.parse(await request.json());
    const actor = await proposalActor(session);
    const proposalId = (await params).id;
    const proposal = await prisma.proposal.findFirst({
      where: { id: proposalId, deletedAt: null, OR: [{ ownerId: session.id }, { opportunity: buildOpportunityScopeWhere(actor.authorization) }] },
      include: {
        status: { select: { terminal: true } },
        customer: { select: { id: true, name: true, segment: true, province: true } },
        opportunity: { include: { painPoints: { take: 20, orderBy: { priority: "asc" } }, structuredRequirements: { take: 50, orderBy: { createdAt: "asc" } }, activities: { where: { deletedAt: null }, take: 20, orderBy: { createdAt: "desc" }, select: { id: true, subject: true, notes: true, aiSummary: true, outcome: true, activityAt: true } } } },
        versions: { take: 1, orderBy: { versionNumber: "desc" }, include: { sections: { orderBy: { sortOrder: "asc" } } } },
      },
    });
    if (!proposal || !proposal.versions[0]) throw new ProposalAccessError();
    if (proposal.version !== input.expectedVersion) throw new ProposalVersionConflictError();
    if (proposal.status.terminal) throw new ProposalTerminalError();

    const runtime = createProposalRuntime();
    const currentSections = proposal.versions[0].sections.map((section) => ({ ...section, contentType: section.contentType as "RICH_TEXT" | "TABLE" | "IMAGE_REFERENCE", structuredData: section.structuredData && typeof section.structuredData === "object" && !Array.isArray(section.structuredData) ? section.structuredData as Record<string, unknown> : null }));
    const receipt = await prisma.proposalCommandReceipt.findUnique({ where: { actorId_idempotencyKey_command: { actorId: session.id, idempotencyKey: key, command: "proposal.ai-generate" } } });
    if (receipt) {
      const result = await runtime.service.createAiVersion(actor, proposalId, { expectedVersion: proposal.version, sections: currentSections, providerConfigurationVersionId: "replay", providerModel: "replay", promptTemplateVersion: PROPOSAL_AI_PROMPT_VERSION, inputSourceReferences: [] }, correlationId, key);
      return NextResponse.json({ data: result, meta: { correlationId, replayed: true } });
    }
    if (process.env.AI_PROPOSAL_GENERATION_ENABLED !== "true") throw new AiConfigurationRuntimeError();

    const products = await prisma.product.findMany({ where: { id: { in: [...new Set(input.productIds)] }, active: true }, select: { id: true, code: true, name: true, category: true, description: true, listPrice: true } });
    if (products.length !== new Set(input.productIds).size) throw new ProposalAccessError();
    const provider = await createActiveProviderClient();
    const generated = await new ProposalAiService(provider.client).generate({
      customer: proposal.customer,
      opportunity: {
        id: proposal.opportunity.id,
        name: proposal.opportunity.name,
        requirements: proposal.opportunity.requirements,
        qualificationResult: proposal.opportunity.qualificationResult,
        expectedCloseAt: proposal.opportunity.expectedCloseAt?.toISOString() ?? null,
        currency: proposal.opportunity.currency,
        painPoints: proposal.opportunity.painPoints,
        structuredRequirements: proposal.opportunity.structuredRequirements,
      },
      meetingNotes: proposal.opportunity.activities.map((activity) => ({ ...activity, activityAt: activity.activityAt?.toISOString() ?? null })),
      products: products.map((product) => ({ ...product, listPrice: product.listPrice.toFixed(2) })),
      templateSections: currentSections.map(({ sectionCode, title, content }) => ({ sectionCode, title, defaultContent: content })),
    });
    const sourceReferences = [
      { type: "OPPORTUNITY", id: proposal.opportunity.id },
      { type: "CUSTOMER", id: proposal.customer.id },
      ...proposal.opportunity.activities.map((activity) => ({ type: "ACTIVITY", id: activity.id })),
      ...products.map((product) => ({ type: "PRODUCT", id: product.id })),
    ];
    const result = await runtime.service.createAiVersion(actor, proposalId, { expectedVersion: input.expectedVersion, sections: generated.output.sections, providerConfigurationVersionId: provider.configurationVersionId, providerModel: generated.providerModel ?? provider.model, promptTemplateVersion: PROPOSAL_AI_PROMPT_VERSION, inputSourceReferences: sourceReferences }, correlationId, key);
    return NextResponse.json({ data: result, meta: { correlationId } });
  } catch (error) { return workflowApiError(error, correlationId); }
}

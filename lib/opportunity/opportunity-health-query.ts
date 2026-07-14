import type { AuthorizationContext } from "../authorization/authorization-context";
import { prisma } from "../prisma";
import { buildOpportunityScopeWhere } from "./opportunity-query";
import { OpportunityAccessError } from "./opportunity-service";
import { calculateOpportunityHealth } from "./opportunity-health";

export async function getOpportunityHealth(context: AuthorizationContext, id: string, at = new Date()) {
  const opportunity = await prisma.opportunity.findFirst({
    where: { id, ...buildOpportunityScopeWhere(context) },
    select: {
      stage: true, nextAction: true, qualificationResult: true, requirements: true, stakeholderSummary: true, expectedCloseAt: true,
      structuredRequirements: { select: { id: true }, take: 1 },
      stakeholders: { select: { id: true }, take: 1 },
      activities: { where: { deletedAt: null }, select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      solutionDesign: { select: { id: true } },
      quotes: { select: { versions: { select: { status: true }, orderBy: { versionNumber: "desc" }, take: 1 } }, take: 20 },
    },
  });
  if (!opportunity) throw new OpportunityAccessError();
  return calculateOpportunityHealth({
    stage: opportunity.stage,
    lastActivityAt: opportunity.activities[0]?.createdAt ?? null,
    nextAction: opportunity.nextAction,
    qualificationResult: opportunity.qualificationResult,
    requirements: opportunity.requirements ?? (opportunity.structuredRequirements.length ? "STRUCTURED_REQUIREMENTS_PRESENT" : null),
    stakeholderSummary: opportunity.stakeholderSummary ?? (opportunity.stakeholders.length ? "STRUCTURED_STAKEHOLDERS_PRESENT" : null),
    solutionComplete: opportunity.solutionDesign !== null,
    commercialReady: opportunity.quotes.some((quote) => quote.versions.some((version) => ["SUBMITTED", "APPROVED", "SENT", "ACCEPTED"].includes(version.status))),
    expectedCloseAt: opportunity.expectedCloseAt,
  }, at);
}

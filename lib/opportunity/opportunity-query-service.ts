import type { AuthorizationContext } from "../authorization/authorization-context";
import { prisma } from "../prisma";
import { buildOpportunityScopeWhere } from "./opportunity-query";
import { OpportunityAccessError, OpportunityValidationError } from "./opportunity-service";

const MAX_PAGE_SIZE = 200;

function decodeCursor(value?: string) {
  if (!value) return undefined;
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    if (!decoded || decoded.length > 191) throw new Error();
    return decoded;
  } catch { throw new OpportunityValidationError(); }
}

export async function listOpportunities(context: AuthorizationContext, input: { cursor?: string; limit?: number; query?: string }) {
  const limit = input.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE || (input.query?.length ?? 0) > 100) throw new OpportunityValidationError();
  const cursor = decodeCursor(input.cursor);
  const rows = await prisma.opportunity.findMany({
    where: { ...buildOpportunityScopeWhere(context), ...(input.query?.trim() ? { name: { startsWith: input.query.trim() } } : {}) },
    select: { id: true, opportunityNumber: true, version: true, name: true, stage: true, flow: true, estimatedValue: true, currency: true, probability: true, probabilitySource: true, forecastCategory: true, expectedCloseAt: true, ownerId: true, owner: { select: { name: true } }, organizationUnitId: true, customer: { select: { id: true, name: true, segment: true } }, updatedAt: true },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }], ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), take: limit + 1,
  });
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? Buffer.from(items[items.length - 1].id).toString("base64url") : null };
}

export async function getOpportunity(context: AuthorizationContext, id: string) {
  const row = await prisma.opportunity.findFirst({
    where: { id, ...buildOpportunityScopeWhere(context) },
    include: { customer: { select: { id: true, name: true, taxId: true, segment: true } }, owner: { select: { id: true, name: true } }, vendorAssessment: true, painPoints: { orderBy: [{ priority: "desc" }, { createdAt: "desc" }], take: 100 }, structuredRequirements: { orderBy: [{ mandatoryFlag: "desc" }, { createdAt: "desc" }], take: 200 }, stakeholders: { orderBy: [{ primaryContactFlag: "desc" }, { influenceLevel: "desc" }, { createdAt: "asc" }], take: 200 }, competitors: { orderBy: [{ threatLevel: "desc" }, { createdAt: "desc" }], take: 100 }, stageHistory: { orderBy: { transitionedAt: "desc" }, take: 50 }, probabilityHistory: { orderBy: { changedAt: "desc" }, take: 50, include: { changedBy: { select: { name: true } } } }, activities: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 20 }, coverageChecks: { orderBy: { createdAt: "desc" }, take: 20 }, solutionDesign: true, quotes: { select: { id: true, quoteNo: true, status: true, version: true, versions: { select: { status: true }, orderBy: { versionNumber: "desc" }, take: 1 } } } },
  });
  if (!row) throw new OpportunityAccessError();
  return row;
}

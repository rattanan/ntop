import type { Prisma } from "@prisma/client";

import type { AuthorizationContext } from "../authorization/authorization-context";

export function buildOpportunityScopeWhere(
  context: AuthorizationContext,
): Prisma.OpportunityWhereInput {
  if (context.assignments.some((item) => item.scope === "ENTERPRISE")) return {};
  const organizationUnitIds = context.assignments.flatMap((item) =>
    (item.scope === "ORG_UNIT" || item.scope === "TEAM") && item.organizationUnitId
      ? [item.organizationUnitId]
      : [],
  );
  return {
    OR: [
      { ownerId: context.actorId },
      ...(organizationUnitIds.length
        ? [{ organizationUnitId: { in: [...new Set(organizationUnitIds)] } }]
        : []),
    ],
  };
}

import type { Prisma } from "@prisma/client";

import { authorizedOrganizationUnitIds, type AuthorizationContext } from "../authorization/authorization-context";

export function buildOpportunityScopeWhere(
  context: AuthorizationContext,
): Prisma.OpportunityWhereInput {
  const organizationUnitIds = authorizedOrganizationUnitIds(context);
  return {
    OR: [
      { ownerId: context.actorId, organizationUnitId: null },
      ...(organizationUnitIds.length
        ? [{ organizationUnitId: { in: organizationUnitIds } }]
        : []),
    ],
  };
}

import type { Prisma } from "@prisma/client";

import type { AuthorizationContext } from "../authorization/authorization-context";

export function buildActivityScopeWhere(context: AuthorizationContext): Prisma.ActivityWhereInput {
  if (context.assignments.some((assignment) => assignment.scope === "ENTERPRISE")) return {};
  const organizationUnitIds = [...new Set(context.assignments.flatMap((assignment) =>
    (assignment.scope === "TEAM" || assignment.scope === "ORG_UNIT") && assignment.organizationUnitId
      ? [assignment.organizationUnitId]
      : [],
  ))];
  return {
    OR: [
      { ownerId: context.actorId },
      ...(organizationUnitIds.length ? [
        { customer: { organizationUnitId: { in: organizationUnitIds } } },
        { opportunity: { organizationUnitId: { in: organizationUnitIds } } },
        { lead: { organizationUnitId: { in: organizationUnitIds } } },
        { prospect: { responsibleBusinessUnitId: { in: organizationUnitIds } } },
      ] : []),
    ],
  };
}

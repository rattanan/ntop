import type { Role } from "@prisma/client";

import { prisma } from "../prisma";
import {
  isAuthorizationScope,
  isEnterpriseRole,
  legacyRoleAssignment,
  type EffectiveRoleAssignment,
} from "./enterprise-role-policy";

export type AuthorizationContext = {
  actorId: string;
  assignments: readonly EffectiveRoleAssignment[];
};

export async function loadAuthorizationContext(input: {
  actorId: string;
  legacyRole: Role;
  now?: Date;
}): Promise<AuthorizationContext> {
  const now = input.now ?? new Date();
  const records = await prisma.userRoleAssignment.findMany({
    where: {
      userId: input.actorId,
      active: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    select: {
      roleCode: true,
      scopeCode: true,
      organizationUnitId: true,
    },
  });
  const assignments = records.flatMap((record) =>
    isEnterpriseRole(record.roleCode) &&
    isAuthorizationScope(record.scopeCode)
      ? [
          {
            role: record.roleCode,
            scope: record.scopeCode,
            organizationUnitId: record.organizationUnitId,
          },
        ]
      : [],
  );
  return {
    actorId: input.actorId,
    assignments:
      assignments.length > 0
        ? assignments
        : [legacyRoleAssignment(input.legacyRole)],
  };
}

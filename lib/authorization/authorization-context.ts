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

export async function loadGrantedPermissions(
  context: AuthorizationContext,
): Promise<string[]> {
  const roleCodes = [...new Set(context.assignments.map((assignment) => assignment.role))];
  if (roleCodes.length === 0) return [];

  const grants = await prisma.rolePermissionGrant.findMany({
    where: { roleCode: { in: roleCodes } },
    select: { permissionCode: true },
    orderBy: { permissionCode: "asc" },
  });

  return [...new Set(grants.map((grant) => grant.permissionCode))];
}

import type { Prisma } from "@prisma/client";

import { authorizedOrganizationUnitIds, type AuthorizationContext } from "../authorization/authorization-context";
import type { Permission } from "../authorization/permission-policy";
import { prisma } from "../prisma";

export async function loadForecastPermissions(context: AuthorizationContext) {
  const roles = [...new Set(context.assignments.map((assignment) => assignment.role))];
  const grants = await prisma.rolePermissionGrant.findMany({
    where: { roleCode: { in: roles } },
    select: { permissionCode: true },
  });
  return new Set(grants.map((grant) => grant.permissionCode));
}

export class ForecastAccessError extends Error {
  constructor() {
    super("Forecast resource is unavailable.");
    this.name = "ForecastAccessError";
  }
}

export function requireForecastPermission(permissions: ReadonlySet<string>, permission: Permission) {
  if (!permissions.has(permission)) throw new ForecastAccessError();
}

export function buildSalesTargetScopeWhere(context: AuthorizationContext): Prisma.SalesTargetWhereInput {
  const organizationUnitIds = authorizedOrganizationUnitIds(context);
  return {
    OR: [
      { userId: context.actorId },
      ...(organizationUnitIds.length ? [
        { teamId: { in: organizationUnitIds } },
        { departmentId: { in: organizationUnitIds } },
        { businessUnitId: { in: organizationUnitIds } },
      ] : []),
    ],
  };
}

export function canManageSalesTargetScope(context: AuthorizationContext, input: { userId: string | null; teamId: string | null; departmentId: string | null; businessUnitId: string | null }) {
  const organizationUnitIds = new Set(authorizedOrganizationUnitIds(context));
  return input.userId === context.actorId || [input.teamId, input.departmentId, input.businessUnitId].some((id) => id !== null && organizationUnitIds.has(id));
}

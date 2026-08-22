import type { Prisma } from "@prisma/client";
import { authorizedOrganizationUnitIds, type AuthorizationContext } from "../authorization/authorization-context";
import type { Permission } from "../authorization/permission-policy";
import { prisma } from "../prisma";

export async function loadProspectPermissions(context: AuthorizationContext) {
  const roles = [...new Set(context.assignments.map(item => item.role))];
  const grants = await prisma.rolePermissionGrant.findMany({ where: { roleCode: { in: roles } }, select: { permissionCode: true } });
  return new Set(grants.map(item => item.permissionCode));
}
export function requireProspectPermission(permissions: ReadonlySet<string>, permission: Permission) { if (!permissions.has(permission)) throw new ProspectAccessError(); }
export function buildProspectOrganizationScopeWhere(context: AuthorizationContext): Prisma.ProspectWhereInput {
  const orgIds = authorizedOrganizationUnitIds(context);
  return { OR: [
    { ownerId: context.actorId, responsibleBusinessUnitId: null, salesTeamId: null },
    { backupOwnerId: context.actorId, responsibleBusinessUnitId: null, salesTeamId: null },
    ...(orgIds.length ? [{ responsibleBusinessUnitId: { in: orgIds } }, { salesTeamId: { in: orgIds } }] : []),
  ] };
}
export function buildProspectScopeWhere(context: AuthorizationContext, permissions: ReadonlySet<string>): Prisma.ProspectWhereInput {
  void permissions;
  return { deletedAt: null, ...buildProspectOrganizationScopeWhere(context) };
}
export class ProspectAccessError extends Error { constructor() { super("Prospect is unavailable."); this.name = "ProspectAccessError"; } }

import type { Prisma } from "@prisma/client";
import type { AuthorizationContext } from "../authorization/authorization-context";
import type { Permission } from "../authorization/permission-policy";
import { prisma } from "../prisma";

export async function loadProspectPermissions(context: AuthorizationContext) {
  const roles = [...new Set(context.assignments.map(item => item.role))];
  const grants = await prisma.rolePermissionGrant.findMany({ where: { roleCode: { in: roles } }, select: { permissionCode: true } });
  return new Set(grants.map(item => item.permissionCode));
}
export function requireProspectPermission(permissions: ReadonlySet<string>, permission: Permission) { if (!permissions.has(permission)) throw new ProspectAccessError(); }
export function buildProspectScopeWhere(context: AuthorizationContext, permissions: ReadonlySet<string>): Prisma.ProspectWhereInput {
  if (permissions.has("prospect.view_all") && context.assignments.some(item => item.scope === "ENTERPRISE")) return { deletedAt: null };
  const orgIds = context.assignments.flatMap(item => item.organizationUnitId && ["TEAM", "ORG_UNIT"].includes(item.scope) ? [item.organizationUnitId] : []);
  return { deletedAt: null, OR: [{ ownerId: context.actorId }, { backupOwnerId: context.actorId }, ...(orgIds.length ? [{ responsibleBusinessUnitId: { in: orgIds } }, { salesTeamId: { in: orgIds } }] : [])] };
}
export class ProspectAccessError extends Error { constructor() { super("Prospect is unavailable."); this.name = "ProspectAccessError"; } }

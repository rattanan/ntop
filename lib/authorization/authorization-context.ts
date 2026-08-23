import type { Prisma, Role } from "@prisma/client";

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
  organizationUnitIds?: readonly string[];
};

export type OrganizationHierarchyNode = { id: string; parentId: string | null };

export function expandOrganizationScopeIds(
  directIds: readonly string[],
  activeUnits: readonly OrganizationHierarchyNode[],
): string[] {
  const activeIds = new Set(activeUnits.map((unit) => unit.id));
  const children = new Map<string, string[]>();
  for (const unit of activeUnits) {
    if (!unit.parentId) continue;
    const values = children.get(unit.parentId) ?? [];
    values.push(unit.id);
    children.set(unit.parentId, values);
  }
  const allowed = new Set(directIds.filter((id) => activeIds.has(id)));
  const queue = [...allowed];
  for (let index = 0; index < queue.length; index += 1) {
    for (const childId of children.get(queue[index]) ?? []) {
      if (allowed.has(childId)) continue;
      allowed.add(childId);
      queue.push(childId);
    }
  }
  return [...allowed];
}

export function authorizedOrganizationUnitIds(context: AuthorizationContext): string[] {
  return [...new Set(context.organizationUnitIds ?? context.assignments.flatMap((assignment) =>
    assignment.organizationUnitId ? [assignment.organizationUnitId] : [],
  ))];
}

export function buildAuthorizedUserWhere(
  context: AuthorizationContext,
  now = new Date(),
): Prisma.UserWhereInput {
  const organizationUnitIds = authorizedOrganizationUnitIds(context);
  return {
    active: true,
    OR: [
      { id: context.actorId },
      ...(organizationUnitIds.length ? [{
        enterpriseRoleAssignments: {
          some: {
            active: true,
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
            organizationUnitId: { in: organizationUnitIds },
          },
        },
      }] : []),
    ],
  };
}

export type AssignableOwnerOption = {
  userId: string;
  name: string;
  email: string;
  organizationUnitId: string;
  organizationUnitName: string;
  organizationUnitCode: string;
};

export function hasEnterpriseOrganizationScope(context: AuthorizationContext) {
  return authorizedOrganizationUnitIds(context).length === 0
    && context.assignments.some((assignment) => assignment.scope === "ENTERPRISE");
}

export function buildAssignableOwnerAssignmentWhere(
  context: AuthorizationContext,
  now = new Date(),
): Prisma.UserRoleAssignmentWhereInput {
  const organizationUnitIds = authorizedOrganizationUnitIds(context);
  const enterprise = hasEnterpriseOrganizationScope(context);
  return {
    active: true,
    effectiveFrom: { lte: now },
    OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    user: { active: true },
    organizationUnit: { active: true },
    organizationUnitId: enterprise ? { not: null } : { in: organizationUnitIds },
  };
}

export async function loadAssignableOwnerOptions(
  context: AuthorizationContext,
  now = new Date(),
): Promise<AssignableOwnerOption[]> {
  if (!hasEnterpriseOrganizationScope(context) && authorizedOrganizationUnitIds(context).length === 0) return [];
  const assignments = await prisma.userRoleAssignment.findMany({
    where: buildAssignableOwnerAssignmentWhere(context, now),
    select: {
      userId: true,
      organizationUnitId: true,
      user: { select: { name: true, email: true } },
      organizationUnit: { select: { name: true, code: true } },
    },
    orderBy: [
      { organizationUnit: { name: "asc" } },
      { user: { name: "asc" } },
      { userId: "asc" },
    ],
    take: 2000,
  });
  const options = new Map<string, AssignableOwnerOption>();
  for (const assignment of assignments) {
    if (!assignment.organizationUnitId || !assignment.organizationUnit) continue;
    const key = `${assignment.userId}:${assignment.organizationUnitId}`;
    if (options.has(key)) continue;
    options.set(key, {
      userId: assignment.userId,
      name: assignment.user.name,
      email: assignment.user.email,
      organizationUnitId: assignment.organizationUnitId,
      organizationUnitName: assignment.organizationUnit.name,
      organizationUnitCode: assignment.organizationUnit.code,
    });
  }
  return [...options.values()];
}

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
  const effectiveAssignments = assignments.length > 0
    ? assignments
    : [legacyRoleAssignment(input.legacyRole)];
  const directOrganizationUnitIds = [...new Set(effectiveAssignments.flatMap((assignment) =>
    assignment.organizationUnitId ? [assignment.organizationUnitId] : [],
  ))];
  const activeUnits = directOrganizationUnitIds.length
    ? await prisma.organizationUnit.findMany({
        where: { active: true },
        select: { id: true, parentId: true },
      })
    : [];
  return {
    actorId: input.actorId,
    assignments: effectiveAssignments,
    organizationUnitIds: expandOrganizationScopeIds(directOrganizationUnitIds, activeUnits),
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

import { type ActivityType, type PrismaClient } from "@prisma/client";

import type { AuthorizationContext } from "../authorization/authorization-context";
import { buildCustomerScopeWhere } from "../customer/customer-query-service";
import { buildOpportunityScopeWhere } from "../opportunity/opportunity-query";
import { buildActivityScopeWhere } from "./activity-authorization";
import type { ActivityRepository, ActivityTransaction } from "./activity-service";

export class PrismaActivityRepository implements ActivityRepository {
  constructor(private client: PrismaClient) {}
  transaction<T>(work: (transaction: ActivityTransaction) => Promise<T>) { return this.client.$transaction(work); }
  findAccessible(id: string, context: AuthorizationContext, transaction: ActivityTransaction) {
    return transaction.activity.findFirst({ where: { id, deletedAt: null, ...buildActivityScopeWhere(context) }, select: { id: true, version: true, ownerId: true, statusCode: true, status: { select: { terminal: true } }, customerId: true, opportunityId: true } }).then((value) => value ? { ...value, terminal: value.status.terminal } : null);
  }
  async targetIsAccessible(input: { customerId?: string | null; opportunityId?: string | null }, context: AuthorizationContext, transaction: ActivityTransaction) {
    const [customer, opportunity] = await Promise.all([
      input.customerId ? transaction.customer.count({ where: { id: input.customerId, mergedIntoCustomerId: null, ...buildCustomerScopeWhere(context) } }) : 1,
      input.opportunityId ? transaction.opportunity.count({ where: { id: input.opportunityId, ...buildOpportunityScopeWhere(context) } }) : 1,
    ]);
    return customer === 1 && opportunity === 1;
  }
  async updateVersioned(id: string, expectedVersion: number, data: { subject: string; type: ActivityType; dueAt: Date | null; notes: string | null; customerId: string | null; opportunityId: string | null }, transaction: ActivityTransaction) {
    const updated = await transaction.activity.updateMany({ where: { id, version: expectedVersion, deletedAt: null }, data: { ...data, version: { increment: 1 } } });
    return updated.count === 1 ? transaction.activity.findUniqueOrThrow({ where: { id }, select: { id: true, version: true } }) : null;
  }
  async softDeleteVersioned(id: string, expectedVersion: number, actorId: string, transaction: ActivityTransaction) {
    const updated = await transaction.activity.updateMany({ where: { id, version: expectedVersion, deletedAt: null }, data: { deletedAt: new Date(), deletedById: actorId, version: { increment: 1 } } });
    return updated.count === 1 ? transaction.activity.findUniqueOrThrow({ where: { id }, select: { id: true, version: true } }) : null;
  }
  async actorHasPermission(actorId: string, permission: string, transaction: ActivityTransaction) {
    const roles = await transaction.userRoleAssignment.findMany({ where: { userId: actorId, active: true }, select: { roleCode: true } });
    return Boolean(await transaction.rolePermissionGrant.findFirst({ where: { roleCode: { in: roles.map((role) => role.roleCode) }, permissionCode: permission } }));
  }
  async assigneeIsEligible(actorId: string, ownerId: string, context: AuthorizationContext, transaction: ActivityTransaction) {
    if (ownerId === actorId) return true;
    if (context.assignments.some((assignment) => assignment.scope === "ENTERPRISE")) return Boolean(await transaction.user.findFirst({ where: { id: ownerId, active: true } }));
    const organizationUnitIds = [...new Set(context.assignments.flatMap((assignment) => assignment.organizationUnitId && (assignment.scope === "TEAM" || assignment.scope === "ORG_UNIT") ? [assignment.organizationUnitId] : []))];
    if (!organizationUnitIds.length) return false;
    return Boolean(await transaction.user.findFirst({ where: { id: ownerId, active: true, enterpriseRoleAssignments: { some: { active: true, organizationUnitId: { in: organizationUnitIds } } } } }));
  }
  async assignVersioned(id: string, expectedVersion: number, ownerId: string, transaction: ActivityTransaction) {
    const updated = await transaction.activity.updateMany({ where: { id, version: expectedVersion, deletedAt: null }, data: { ownerId, version: { increment: 1 } } });
    return updated.count === 1 ? transaction.activity.findUniqueOrThrow({ where: { id }, select: { id: true, version: true } }) : null;
  }
  async findTransition(fromStatusCode: string, toStatusCode: string, transaction: ActivityTransaction) {
    const edge = await transaction.activityStatusTransition.findFirst({ where: { fromStatusCode, toStatusCode, active: true, toStatus: { active: true } }, select: { requiredPermission: true, ownerOnly: true, toStatus: { select: { terminal: true } } } });
    return edge ? { requiredPermission: edge.requiredPermission, ownerOnly: edge.ownerOnly, targetTerminal: edge.toStatus.terminal } : null;
  }
  async transitionVersioned(id: string, expectedVersion: number, input: { toStatusCode: string; completedAt: Date | null; completionOutcome: string | null }, transaction: ActivityTransaction) {
    const updated = await transaction.activity.updateMany({ where: { id, version: expectedVersion, deletedAt: null }, data: { statusCode: input.toStatusCode, completedAt: input.completedAt, completionOutcome: input.completionOutcome, version: { increment: 1 } } });
    return updated.count === 1 ? transaction.activity.findUniqueOrThrow({ where: { id }, select: { id: true, version: true, statusCode: true } }) : null;
  }
}

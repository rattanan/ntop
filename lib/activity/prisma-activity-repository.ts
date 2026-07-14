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
    return transaction.activity.findFirst({ where: { id, deletedAt: null, ...buildActivityScopeWhere(context) }, select: { id: true, version: true, customerId: true, opportunityId: true } });
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
}

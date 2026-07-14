import { LeadStatus, Prisma, type PrismaClient } from "@prisma/client";

import type { AuthorizationContext } from "../authorization/authorization-context";
import { matchesAssignmentRule, nextRoundRobinUser, type AssignmentCriteria } from "./lead-assignment";
import type { LeadCommand, LeadRecord, LeadRepository } from "./lead-service";
import { firstContactDueAt, formatLeadNumber, LEAD_QUALIFIED_VIEW_ROLES, LEAD_ROUND_ROBIN_ROLE, temperatureForScore } from "./lead-rules";

export type LeadTransaction = Prisma.TransactionClient;

export function buildLeadScopeWhere(context: AuthorizationContext): Prisma.LeadWhereInput {
  const qualifiedOnly = context.assignments.length > 0 && context.assignments.every((assignment) => (LEAD_QUALIFIED_VIEW_ROLES as readonly string[]).includes(assignment.role));
  if (context.assignments.some((assignment) => assignment.scope === "ENTERPRISE")) return qualifiedOnly ? { status: LeadStatus.QUALIFIED } : {};
  const organizationUnitIds = context.assignments.flatMap((assignment) => (assignment.scope === "TEAM" || assignment.scope === "ORG_UNIT") && assignment.organizationUnitId ? [assignment.organizationUnitId] : []);
  const scope: Prisma.LeadWhereInput = { OR: [{ ownerId: context.actorId }, ...(organizationUnitIds.length ? [{ organizationUnitId: { in: [...new Set(organizationUnitIds)] } }] : [])] };
  return qualifiedOnly ? { AND: [scope, { status: LeadStatus.QUALIFIED }] } : scope;
}

const select = { id: true, company: true, contactName: true, contactEmail: true, contactPhone: true, source: true, status: true, temperature: true, score: true, recommendedProducts: true, notes: true, disqualificationReason: true, ownerId: true, organizationUnitId: true, customerId: true, contactId: true, version: true } as const;

function record(value: Awaited<ReturnType<LeadTransaction["lead"]["findFirst"]>> & Record<string, unknown>): LeadRecord {
  return {
    id: value.id as string,
    company: value.company as string,
    contactName: value.contactName as string,
    contactEmail: (value.contactEmail as string | null) ?? "",
    contactPhone: (value.contactPhone as string | null) ?? undefined,
    source: value.source as LeadRecord["source"],
    status: value.status as LeadRecord["status"],
    temperature: value.temperature as LeadRecord["temperature"],
    score: value.score as number,
    recommendedProducts: (value.recommendedProducts as string | null) ?? undefined,
    notes: (value.notes as string | null) ?? undefined,
    disqualificationReason: (value.disqualificationReason as string | null) ?? undefined,
    ownerId: value.ownerId as string,
    customerId: value.customerId as string | null,
    contactId: value.contactId as string | null,
    organizationUnitId: value.organizationUnitId as string | null,
    version: value.version as number,
  };
}

export class PrismaLeadRepository implements LeadRepository<LeadTransaction> {
  constructor(private readonly client: PrismaClient) {}
  transaction<T>(work: (transaction: LeadTransaction) => Promise<T>) { return this.client.$transaction(work); }
  async hasGrantedPermission(roleCodes: readonly string[], permission: string, transaction: LeadTransaction) { return (await transaction.rolePermissionGrant.count({ where: { roleCode: { in: [...roleCodes] }, permissionCode: permission } })) > 0; }
  async findAccessible(id: string, context: AuthorizationContext, transaction: LeadTransaction) {
    const value = await transaction.lead.findFirst({ where: { id, ...buildLeadScopeWhere(context) }, select });
    return value ? record(value as never) : null;
  }
  findReceipt(actorId: string, idempotencyKey: string, command: string, transaction: LeadTransaction) {
    return transaction.leadCommandReceipt.findUnique({ where: { actorId_idempotencyKey_command: { actorId, idempotencyKey, command } }, select: { leadId: true, customerId: true, contactId: true, opportunityId: true, resultVersion: true } });
  }
  async saveReceipt(input: { actorId: string; idempotencyKey: string; command: string; leadId: string; customerId: string | null; contactId?: string | null; opportunityId?: string | null; resultVersion: number }, transaction: LeadTransaction) { await transaction.leadCommandReceipt.create({ data: input }); }
  async create(input: LeadCommand & { ownerId: string; actorId: string; correlationId: string }, transaction: LeadTransaction) {
    const rules = await transaction.leadAssignmentRule.findMany({ where: { active: true }, orderBy: [{ priority: "asc" }, { id: "asc" }], take: 100 });
    const now = new Date();
    let automaticAssignment: { ownerId: string; organizationUnitId: string | null; ruleId: string; ruleName: string } | null = null;
    for (const rule of rules) {
      if (!matchesAssignmentRule(rule.criteria as AssignmentCriteria, { source: input.source, company: input.company, recommendedProducts: input.recommendedProducts })) continue;
      if (rule.strategy === "OWNER" && rule.targetOwnerId) {
        const owner = await transaction.user.findFirst({ where: { id: rule.targetOwnerId, active: true }, select: { id: true } });
        if (owner) automaticAssignment = { ownerId: owner.id, organizationUnitId: rule.organizationUnitId, ruleId: rule.id, ruleName: rule.name };
      } else if (rule.strategy === "ROUND_ROBIN" && rule.organizationUnitId) {
        await transaction.$queryRaw(Prisma.sql`SELECT id FROM LeadAssignmentRule WHERE id = ${rule.id} FOR UPDATE`);
        const lockedRule = await transaction.leadAssignmentRule.findUniqueOrThrow({ where: { id: rule.id }, select: { lastAssignedUserId: true } });
        const assignments = await transaction.userRoleAssignment.findMany({
          where: { organizationUnitId: rule.organizationUnitId, roleCode: LEAD_ROUND_ROBIN_ROLE, active: true, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }], user: { active: true } },
          select: { userId: true }, orderBy: [{ userId: "asc" }], take: 500,
        });
        const ownerId = nextRoundRobinUser([...new Set(assignments.map(item => item.userId))], lockedRule.lastAssignedUserId);
        if (ownerId) {
          await transaction.leadAssignmentRule.update({ where: { id: rule.id }, data: { lastAssignedUserId: ownerId } });
          automaticAssignment = { ownerId, organizationUnitId: rule.organizationUnitId, ruleId: rule.id, ruleName: rule.name };
        }
      }
      if (automaticAssignment) break;
    }
    const sequence = await transaction.leadNumberSequence.upsert({ where: { id: "lead" }, create: { id: "lead", nextValue: 1 }, update: { nextValue: { increment: 1 } } });
    const temperature = temperatureForScore(input.score);
    const { actorId, correlationId, ...command } = input;
    const value = await transaction.lead.create({ data: { ...command, ownerId: automaticAssignment?.ownerId ?? input.ownerId, organizationUnitId: automaticAssignment?.organizationUnitId, status: automaticAssignment && input.status === LeadStatus.NEW ? LeadStatus.ASSIGNED : input.status, temperature, assignedAt: automaticAssignment ? now : null, firstContactDueAt: automaticAssignment ? firstContactDueAt(now, temperature) : null, leadNumber: formatLeadNumber(sequence.nextValue), contactEmail: input.contactEmail || null, contactPhone: input.contactPhone || null, recommendedProducts: input.recommendedProducts || null, notes: input.notes || null, customerId: input.customerId || null }, select });
    if (automaticAssignment) {
      await transaction.leadAssignmentHistory.create({ data: { leadId: value.id, fromOwnerId: input.ownerId, toOwnerId: automaticAssignment.ownerId, actorId, reason: `AUTO_RULE:${automaticAssignment.ruleId}:${automaticAssignment.ruleName}`, assignedAt: now } });
      if (input.status === LeadStatus.NEW) await transaction.leadStatusHistory.create({ data: { leadId: value.id, fromStatus: LeadStatus.NEW, toStatus: LeadStatus.ASSIGNED, actorId, correlationId, reason: `AUTO_RULE:${automaticAssignment.ruleId}:${automaticAssignment.ruleName}` } });
    }
    return record(value as never);
  }
  async findPotentialDuplicates(input: LeadCommand, transaction: LeadTransaction) {
    const rows = await transaction.lead.findMany({ where: { status: { not: LeadStatus.ARCHIVED }, OR: [{ company: input.company }, ...(input.contactEmail ? [{ contactEmail: input.contactEmail }] : []), ...(input.contactPhone ? [{ contactPhone: input.contactPhone }] : [])] }, select: { id: true, company: true, contactEmail: true, contactPhone: true }, take: 20 });
    return rows.map(row => ({ id: row.id, reasons: [row.company === input.company ? "COMPANY" : null, input.contactEmail && row.contactEmail === input.contactEmail ? "EMAIL" : null, input.contactPhone && row.contactPhone === input.contactPhone ? "PHONE" : null].filter((value): value is string => Boolean(value)) }));
  }
  async updateVersioned(id: string, expectedVersion: number, input: LeadCommand, transaction: LeadTransaction) {
    const updated = await transaction.lead.updateMany({ where: { id, version: expectedVersion, status: { not: LeadStatus.CONVERTED } }, data: { ...input, contactEmail: input.contactEmail || null, contactPhone: input.contactPhone || null, recommendedProducts: input.recommendedProducts || null, notes: input.notes || null, disqualificationReason: input.disqualificationReason || null, archivedAt: input.status === LeadStatus.ARCHIVED ? new Date() : null, customerId: input.customerId || null, version: { increment: 1 } } });
    if (updated.count !== 1) return null;
    return record(await transaction.lead.findUniqueOrThrow({ where: { id }, select }) as never);
  }
  async markConverted(id: string, expectedVersion: number, customerId: string, transaction: LeadTransaction) {
    const updated = await transaction.lead.updateMany({ where: { id, version: expectedVersion, OR: [{ customerId: null }, { customerId }], status: { not: LeadStatus.CONVERTED } }, data: { status: LeadStatus.CONVERTED, customerId, convertedAt: new Date(), version: { increment: 1 } } });
    if (updated.count !== 1) return null;
    return record(await transaction.lead.findUniqueOrThrow({ where: { id }, select }) as never);
  }
  async recordStatusTransition(input: { leadId: string; fromStatus: LeadStatus; toStatus: LeadStatus; reason?: string; actorId: string; correlationId: string }, transaction: LeadTransaction) {
    await transaction.leadStatusHistory.create({ data: input });
  }
  async completeConversion(input: { lead: LeadRecord; expectedVersion: number; customerId: string; opportunityName: string; opportunityFlow: string; estimatedValue: string; expectedCloseAt: Date; probability: number; productInterest?: string }, transaction: LeadTransaction) {
    const matches = [...(input.lead.contactEmail ? [{ email: input.lead.contactEmail }] : []), ...(input.lead.contactPhone ? [{ phone: input.lead.contactPhone }] : []), { name: input.lead.contactName }];
    const existingContact = await transaction.contact.findFirst({ where: { customerId: input.customerId, OR: matches }, orderBy: { isPrimary: "desc" } });
    const contact = existingContact ?? await transaction.contact.create({ data: { customerId: input.customerId, name: input.lead.contactName, email: input.lead.contactEmail || null, phone: input.lead.contactPhone || null, purpose: "LEAD_CONVERSION", isPrimary: true } });
    const year = new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date());
    const sequenceId = `OPP-${year}`;
    await transaction.opportunityNumberSequence.upsert({ where: { id: sequenceId }, update: {}, create: { id: sequenceId, nextValue: 0 } });
    const sequence = await transaction.opportunityNumberSequence.update({ where: { id: sequenceId }, data: { nextValue: { increment: 1 } } });
    const opportunity = await transaction.opportunity.create({ data: { opportunityNumber: `OPP-${year}-${String(sequence.nextValue).padStart(6, "0")}`, name: input.opportunityName, customerId: input.customerId, flow: input.opportunityFlow, estimatedValue: input.estimatedValue, probability: input.probability, expectedCloseAt: input.expectedCloseAt, organizationUnitId: input.lead.organizationUnitId ?? null, ownerId: input.lead.ownerId, requirements: input.lead.notes ?? null, nextAction: input.productInterest ?? input.lead.recommendedProducts ?? null, sourceLeadId: input.lead.id } });
    const updated = await transaction.lead.updateMany({ where: { id: input.lead.id, version: input.expectedVersion, status: LeadStatus.QUALIFIED }, data: { status: LeadStatus.CONVERTED, customerId: input.customerId, contactId: contact.id, convertedAt: new Date(), version: { increment: 1 } } });
    if (updated.count !== 1) return null;
    return { lead: record(await transaction.lead.findUniqueOrThrow({ where: { id: input.lead.id }, select }) as never), contactId: contact.id, opportunityId: opportunity.id };
  }
  async isAssignableOwner(ownerId: string, organizationUnitId: string | null, transaction: LeadTransaction) {
    return (await transaction.user.count({ where: { id: ownerId, active: true, ...(organizationUnitId ? { enterpriseRoleAssignments: { some: { organizationUnitId, active: true } } } : {}) } })) === 1;
  }
  async assignVersioned(input: { leadId: string; expectedVersion: number; currentStatus: LeadStatus; temperature: "HOT"|"WARM"|"COLD"; fromOwnerId: string; toOwnerId: string; actorId: string; reason: string; assignedAt: Date }, transaction: LeadTransaction) {
    const updated = await transaction.lead.updateMany({ where: { id: input.leadId, version: input.expectedVersion, status: input.currentStatus }, data: { ownerId: input.toOwnerId, assignedAt: input.assignedAt, firstContactDueAt: input.currentStatus === LeadStatus.NEW ? firstContactDueAt(input.assignedAt,input.temperature) : undefined, status: input.currentStatus === LeadStatus.NEW ? LeadStatus.ASSIGNED : input.currentStatus, version: { increment: 1 } } });
    if (updated.count !== 1) return null;
    await transaction.leadAssignmentHistory.create({ data: { leadId: input.leadId, fromOwnerId: input.fromOwnerId, toOwnerId: input.toOwnerId, actorId: input.actorId, reason: input.reason, assignedAt: input.assignedAt } });
    return record(await transaction.lead.findUniqueOrThrow({ where: { id: input.leadId }, select }) as never);
  }
}

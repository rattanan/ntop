import { ActivityType, type Prisma, type Role } from "@prisma/client";
import { z } from "zod";

import type { AuditWriter } from "../audit/audit-writer";
import type { AuthorizationContext } from "../authorization/authorization-context";
import { assertPermission, PERMISSIONS, PermissionDeniedError, type Permission, type PermissionPolicy } from "../authorization/permission-policy";
import { permissionPolicy } from "../authorization/permission-policy";

export type ActivityActor = { id: string; role: Role; authorization: AuthorizationContext };
export type ActivityTransaction = Prisma.TransactionClient;

const nullableId = z.union([z.string().trim().min(1).max(191), z.literal(""), z.null()]).optional();
const updateSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  subject: z.string().trim().min(2).max(255),
  type: z.enum(ActivityType),
  dueAt: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(20_000).nullable().optional(),
  customerId: nullableId,
  opportunityId: nullableId,
});
const deleteSchema = z.strictObject({ expectedVersion: z.number().int().positive(), reason: z.string().trim().min(5).max(1000) });
const assignSchema = z.strictObject({ expectedVersion: z.number().int().positive(), ownerId: z.string().trim().min(1).max(191), reason: z.string().trim().min(3).max(1000) });
const transitionSchema = z.strictObject({ expectedVersion: z.number().int().positive(), toStatusCode: z.string().trim().min(1).max(32), reason: z.string().trim().min(3).max(1000), outcome: z.string().trim().max(20_000).optional() });

export class ActivityAccessError extends Error { constructor() { super("ไม่พบ Activity หรือไม่มีสิทธิ์เข้าถึง"); this.name = "ActivityAccessError"; } }
export class ActivityConflictError extends Error { constructor() { super("Activity ถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดข้อมูลล่าสุด"); this.name = "ActivityConflictError"; } }
export class ActivityValidationError extends Error {
  constructor(readonly issues: Record<string, string[]>) { super("ข้อมูล Activity ไม่ถูกต้อง"); this.name = "ActivityValidationError"; }
}

export interface ActivityRepository {
  transaction<T>(work: (transaction: ActivityTransaction) => Promise<T>): Promise<T>;
  findAccessible(id: string, context: AuthorizationContext, transaction: ActivityTransaction): Promise<{ id: string; version: number; ownerId: string; statusCode: string; terminal: boolean; customerId: string | null; opportunityId: string | null } | null>;
  targetIsAccessible(input: { customerId?: string | null; opportunityId?: string | null }, context: AuthorizationContext, transaction: ActivityTransaction): Promise<boolean>;
  updateVersioned(id: string, expectedVersion: number, data: { subject: string; type: ActivityType; dueAt: Date | null; notes: string | null; customerId: string | null; opportunityId: string | null }, transaction: ActivityTransaction): Promise<{ id: string; version: number } | null>;
  softDeleteVersioned(id: string, expectedVersion: number, actorId: string, transaction: ActivityTransaction): Promise<{ id: string; version: number } | null>;
  actorHasPermission(actorId: string, permission: string, transaction: ActivityTransaction): Promise<boolean>;
  assigneeIsEligible(actorId: string, ownerId: string, context: AuthorizationContext, transaction: ActivityTransaction): Promise<boolean>;
  assignVersioned(id: string, expectedVersion: number, ownerId: string, transaction: ActivityTransaction): Promise<{ id: string; version: number } | null>;
  findTransition(fromStatusCode: string, toStatusCode: string, transaction: ActivityTransaction): Promise<{ requiredPermission: string | null; ownerOnly: boolean; targetTerminal: boolean } | null>;
  transitionVersioned(id: string, expectedVersion: number, input: { toStatusCode: string; completedAt: Date | null; completionOutcome: string | null }, transaction: ActivityTransaction): Promise<{ id: string; version: number; statusCode: string } | null>;
}

export class ActivityService {
  constructor(private repository: ActivityRepository, private audit: AuditWriter<ActivityTransaction>, private permissions: PermissionPolicy = permissionPolicy) {}

  async update(actor: ActivityActor, id: string, input: unknown, correlationId: string) {
    assertPermission(actor, PERMISSIONS.recordUpdate, this.permissions);
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) throw new ActivityValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    return this.repository.transaction(async (transaction) => {
      const current = await this.repository.findAccessible(id, actor.authorization, transaction);
      if (!current) throw new ActivityAccessError();
      const customerId = parsed.data.customerId || null;
      const opportunityId = parsed.data.opportunityId || null;
      if (!await this.repository.targetIsAccessible({ customerId, opportunityId }, actor.authorization, transaction)) throw new ActivityAccessError();
      const updated = await this.repository.updateVersioned(id, parsed.data.expectedVersion, {
        subject: parsed.data.subject, type: parsed.data.type, dueAt: parsed.data.dueAt ?? null,
        notes: parsed.data.notes || null, customerId, opportunityId,
      }, transaction);
      if (!updated) throw new ActivityConflictError();
      await this.audit.append({ actorId: actor.id, action: "activity.update", targetType: "Activity", targetId: id, targetVersion: String(updated.version), outcome: "SUCCESS", correlationId, data: { previousVersion: current.version, customerId, opportunityId, type: parsed.data.type } }, { transaction });
      return updated;
    });
  }

  async remove(actor: ActivityActor, id: string, input: unknown, correlationId: string) {
    assertPermission(actor, PERMISSIONS.recordUpdate, this.permissions);
    const parsed = deleteSchema.safeParse(input);
    if (!parsed.success) throw new ActivityValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    return this.repository.transaction(async (transaction) => {
      const current = await this.repository.findAccessible(id, actor.authorization, transaction);
      if (!current) throw new ActivityAccessError();
      const deleted = await this.repository.softDeleteVersioned(id, parsed.data.expectedVersion, actor.id, transaction);
      if (!deleted) throw new ActivityConflictError();
      await this.audit.append({ actorId: actor.id, action: "activity.delete", targetType: "Activity", targetId: id, targetVersion: String(deleted.version), outcome: "SUCCESS", correlationId, reason: parsed.data.reason, data: { previousVersion: current.version } }, { transaction });
      return deleted;
    });
  }

  async assign(actor: ActivityActor, id: string, input: unknown, correlationId: string) {
    const parsed = assignSchema.safeParse(input);
    if (!parsed.success) throw new ActivityValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    return this.repository.transaction(async (transaction) => {
      if (!await this.hasPermission(actor, PERMISSIONS.activityAssign, transaction)) throw new PermissionDeniedError(PERMISSIONS.activityAssign);
      const current = await this.repository.findAccessible(id, actor.authorization, transaction);
      if (!current) throw new ActivityAccessError();
      if (current.terminal) throw new ActivityConflictError();
      if (!await this.repository.assigneeIsEligible(actor.id, parsed.data.ownerId, actor.authorization, transaction)) throw new ActivityAccessError();
      const updated = await this.repository.assignVersioned(id, parsed.data.expectedVersion, parsed.data.ownerId, transaction);
      if (!updated) throw new ActivityConflictError();
      await this.audit.append({ actorId: actor.id, action: "activity.assign", targetType: "Activity", targetId: id, targetVersion: String(updated.version), outcome: "SUCCESS", correlationId, reason: parsed.data.reason, data: { fromOwnerId: current.ownerId, toOwnerId: parsed.data.ownerId } }, { transaction });
      return updated;
    });
  }

  async transition(actor: ActivityActor, id: string, input: unknown, correlationId: string) {
    const parsed = transitionSchema.safeParse(input);
    if (!parsed.success) throw new ActivityValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    return this.repository.transaction(async (transaction) => {
      const current = await this.repository.findAccessible(id, actor.authorization, transaction);
      if (!current) throw new ActivityAccessError();
      if (current.terminal) throw new ActivityConflictError();
      const edge = await this.repository.findTransition(current.statusCode, parsed.data.toStatusCode, transaction);
      if (!edge) throw new ActivityValidationError({ toStatusCode: ["ไม่อนุญาตให้เปลี่ยนสถานะตามเส้นทางนี้"] });
      if (edge.requiredPermission && !await this.hasPermission(actor, edge.requiredPermission as Permission, transaction)) throw new PermissionDeniedError(edge.requiredPermission as Permission);
      if (edge.ownerOnly && current.ownerId !== actor.id) throw new PermissionDeniedError(PERMISSIONS.activityComplete);
      const updated = await this.repository.transitionVersioned(id, parsed.data.expectedVersion, { toStatusCode: parsed.data.toStatusCode, completedAt: edge.targetTerminal && parsed.data.toStatusCode === "COMPLETED" ? new Date() : null, completionOutcome: parsed.data.outcome || null }, transaction);
      if (!updated) throw new ActivityConflictError();
      await this.audit.append({ actorId: actor.id, action: "activity.transition", targetType: "Activity", targetId: id, targetVersion: String(updated.version), outcome: "SUCCESS", correlationId, reason: parsed.data.reason, data: { fromStatusCode: current.statusCode, toStatusCode: updated.statusCode, completionOutcome: parsed.data.outcome || null } }, { transaction });
      return updated;
    });
  }

  private async hasPermission(actor: ActivityActor, permission: Permission, transaction: ActivityTransaction) {
    return this.permissions.allows(actor, permission) || this.repository.actorHasPermission(actor.id, permission, transaction);
  }
}

import { createHash } from "node:crypto";

import { ActivityType, type Prisma, type Role } from "@prisma/client";
import { z } from "zod";

import type { AuditWriter } from "../audit/audit-writer";
import type { AuthorizationContext } from "../authorization/authorization-context";
import { assertPermission, PERMISSIONS, PermissionDeniedError, type Permission, type PermissionPolicy } from "../authorization/permission-policy";
import { permissionPolicy } from "../authorization/permission-policy";
import { createLegacyMeetingDraft } from "../ai/legacy-meeting-draft";

export type ActivityActor = { id: string; role: Role; authorization: AuthorizationContext };
export type ActivityTransaction = Prisma.TransactionClient;

const nullableId = z.union([z.string().trim().min(1).max(191), z.literal(""), z.null()]).optional();
const createSchema = z.strictObject({
  subject: z.string().trim().min(2).max(255),
  type: z.enum(ActivityType),
  dueAt: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(20_000).nullable().optional(),
  customerId: nullableId,
  opportunityId: nullableId,
});
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
const resultsSchema = z.strictObject({ expectedVersion: z.number().int().positive(), outcome: z.string().trim().max(20_000).nullable().optional(), customerFeedback: z.string().trim().max(20_000).nullable().optional(), nextAction: z.string().trim().max(20_000).nullable().optional() });
const insightConfirmationSchema = z.strictObject({ expectedVersion: z.number().int().positive(), aiSummary: z.string().trim().min(1).max(20_000), actionItems: z.string().trim().max(20_000) });

export class ActivityAccessError extends Error { constructor() { super("ไม่พบ Activity หรือไม่มีสิทธิ์เข้าถึง"); this.name = "ActivityAccessError"; } }
export class ActivityConflictError extends Error { constructor() { super("Activity ถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดข้อมูลล่าสุด"); this.name = "ActivityConflictError"; } }
export class ActivityIdempotencyConflictError extends Error { constructor() { super("Idempotency-Key ถูกใช้กับข้อมูล Activity อื่นแล้ว"); this.name = "ActivityIdempotencyConflictError"; } }
export class ActivityValidationError extends Error {
  constructor(readonly issues: Record<string, string[]>) { super("ข้อมูล Activity ไม่ถูกต้อง"); this.name = "ActivityValidationError"; }
}

export interface ActivityRepository {
  transaction<T>(work: (transaction: ActivityTransaction) => Promise<T>): Promise<T>;
  findCreateReceipt(actorId: string, idempotencyKey: string, transaction: ActivityTransaction): Promise<{ requestHash: string; targetId: string; targetVersion: number } | null>;
  create(input: { subject: string; type: ActivityType; dueAt: Date | null; notes: string | null; aiSummary: string | null; actionItems: string | null; customerId: string | null; opportunityId: string | null; ownerId: string }, transaction: ActivityTransaction): Promise<{ id: string; version: number }>;
  saveCreateReceipt(input: { actorId: string; idempotencyKey: string; requestHash: string; targetId: string; targetVersion: number }, transaction: ActivityTransaction): Promise<void>;
  findAccessible(id: string, context: AuthorizationContext, transaction: ActivityTransaction): Promise<{ id: string; version: number; ownerId: string; statusCode: string; terminal: boolean; type: ActivityType; notes: string | null; description: string | null; customerId: string | null; opportunityId: string | null } | null>;
  targetIsAccessible(input: { customerId?: string | null; opportunityId?: string | null }, context: AuthorizationContext, transaction: ActivityTransaction): Promise<boolean>;
  updateVersioned(id: string, expectedVersion: number, data: { subject: string; type: ActivityType; dueAt: Date | null; notes: string | null; customerId: string | null; opportunityId: string | null }, transaction: ActivityTransaction): Promise<{ id: string; version: number } | null>;
  updateResultsVersioned(id: string, expectedVersion: number, data: { outcome: string | null; customerFeedback: string | null; nextAction: string | null }, transaction: ActivityTransaction): Promise<{ id: string; version: number } | null>;
  updateInsightVersioned(id: string, expectedVersion: number, data: { aiSummary: string; actionItems: string | null }, transaction: ActivityTransaction): Promise<{ id: string; version: number } | null>;
  softDeleteVersioned(id: string, expectedVersion: number, actorId: string, transaction: ActivityTransaction): Promise<{ id: string; version: number } | null>;
  actorHasPermission(actorId: string, permission: string, transaction: ActivityTransaction): Promise<boolean>;
  assigneeIsEligible(actorId: string, ownerId: string, context: AuthorizationContext, transaction: ActivityTransaction): Promise<boolean>;
  assignVersioned(id: string, expectedVersion: number, ownerId: string, transaction: ActivityTransaction): Promise<{ id: string; version: number } | null>;
  findTransition(fromStatusCode: string, toStatusCode: string, transaction: ActivityTransaction): Promise<{ requiredPermission: string | null; ownerOnly: boolean; targetTerminal: boolean } | null>;
  transitionVersioned(id: string, expectedVersion: number, input: { toStatusCode: string; completedAt: Date | null; completionOutcome: string | null }, transaction: ActivityTransaction): Promise<{ id: string; version: number; statusCode: string } | null>;
  recordStatusHistory(input: { activityId: string; fromStatusCode: string; toStatusCode: string; reason: string; outcome: string | null; actorId: string; correlationId: string }, transaction: ActivityTransaction): Promise<void>;
}

export class ActivityService {
  constructor(private repository: ActivityRepository, private audit: AuditWriter<ActivityTransaction>, private permissions: PermissionPolicy = permissionPolicy) {}

  async create(actor: ActivityActor, input: unknown, correlationId: string, idempotencyKey: string) {
    assertPermission(actor, PERMISSIONS.recordCreate, this.permissions);
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) throw new ActivityValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    const normalized = {
      ...parsed.data,
      dueAt: parsed.data.dueAt?.toISOString() ?? null,
      notes: parsed.data.notes || null,
      customerId: parsed.data.customerId || null,
      opportunityId: parsed.data.opportunityId || null,
    };
    const requestHash = createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
    return this.repository.transaction(async (transaction) => {
      const receipt = await this.repository.findCreateReceipt(actor.id, idempotencyKey, transaction);
      if (receipt) {
        if (receipt.requestHash !== requestHash) throw new ActivityIdempotencyConflictError();
        return { id: receipt.targetId, version: receipt.targetVersion };
      }
      const customerId = parsed.data.customerId || null;
      const opportunityId = parsed.data.opportunityId || null;
      if (!await this.repository.targetIsAccessible({ customerId, opportunityId }, actor.authorization, transaction)) throw new ActivityAccessError();
      const notes = parsed.data.notes || null;
      const meetingDraft = parsed.data.type === ActivityType.MEETING ? createLegacyMeetingDraft(notes ?? "") : null;
      const created = await this.repository.create({
        subject: parsed.data.subject,
        type: parsed.data.type,
        dueAt: parsed.data.dueAt ?? null,
        notes,
        aiSummary: meetingDraft?.summary ?? null,
        actionItems: meetingDraft?.actionItems ?? null,
        customerId,
        opportunityId,
        ownerId: actor.id,
      }, transaction);
      await this.audit.append({ actorId: actor.id, action: "activity.create", targetType: "Activity", targetId: created.id, targetVersion: String(created.version), outcome: "SUCCESS", correlationId, data: { customerId, opportunityId, type: parsed.data.type } }, { transaction });
      await this.repository.saveCreateReceipt({ actorId: actor.id, idempotencyKey, requestHash, targetId: created.id, targetVersion: created.version }, transaction);
      return created;
    });
  }

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

  async updateResults(actor: ActivityActor, id: string, input: unknown, correlationId: string) {
    assertPermission(actor, PERMISSIONS.recordUpdate, this.permissions);
    const parsed = resultsSchema.safeParse(input);
    if (!parsed.success) throw new ActivityValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    return this.repository.transaction(async (transaction) => {
      const current = await this.repository.findAccessible(id, actor.authorization, transaction);
      if (!current) throw new ActivityAccessError();
      const values = {
        outcome: parsed.data.outcome || null,
        customerFeedback: parsed.data.customerFeedback || null,
        nextAction: parsed.data.nextAction || null,
      };
      const updated = await this.repository.updateResultsVersioned(id, parsed.data.expectedVersion, values, transaction);
      if (!updated) throw new ActivityConflictError();
      await this.audit.append({ actorId: actor.id, action: "activity.results.update", targetType: "Activity", targetId: id, targetVersion: String(updated.version), outcome: "SUCCESS", correlationId, data: { previousVersion: current.version, hasOutcome: Boolean(values.outcome), hasCustomerFeedback: Boolean(values.customerFeedback), hasNextAction: Boolean(values.nextAction) } }, { transaction });
      return updated;
    });
  }

  async draftMeetingInsight(actor: ActivityActor, id: string) {
    assertPermission(actor, PERMISSIONS.recordUpdate, this.permissions);
    return this.repository.transaction(async (transaction) => {
      const current = await this.repository.findAccessible(id, actor.authorization, transaction);
      if (!current) throw new ActivityAccessError();
      if (current.type !== ActivityType.MEETING) throw new ActivityValidationError({ type: ["AI Meeting Insight ใช้ได้เฉพาะ Activity ประเภท Meeting"] });
      const meetingText = (current.notes ?? current.description ?? "").trim();
      if (!meetingText) throw new ActivityValidationError({ notes: ["กรุณาบันทึกรายละเอียดการประชุมก่อน Generate Insight"] });
      return createLegacyMeetingDraft(meetingText);
    });
  }

  async confirmMeetingInsight(actor: ActivityActor, id: string, input: unknown, correlationId: string) {
    assertPermission(actor, PERMISSIONS.recordUpdate, this.permissions);
    const parsed = insightConfirmationSchema.safeParse(input);
    if (!parsed.success) throw new ActivityValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    return this.repository.transaction(async (transaction) => {
      const current = await this.repository.findAccessible(id, actor.authorization, transaction);
      if (!current) throw new ActivityAccessError();
      if (current.type !== ActivityType.MEETING) throw new ActivityValidationError({ type: ["AI Meeting Insight ใช้ได้เฉพาะ Activity ประเภท Meeting"] });
      const updated = await this.repository.updateInsightVersioned(id, parsed.data.expectedVersion, { aiSummary: parsed.data.aiSummary, actionItems: parsed.data.actionItems || null }, transaction);
      if (!updated) throw new ActivityConflictError();
      await this.audit.append({ actorId: actor.id, action: "activity.meeting-insight.confirm", targetType: "Activity", targetId: id, targetVersion: String(updated.version), outcome: "SUCCESS", correlationId, data: { previousVersion: current.version, humanConfirmed: true, source: "USER_ENTERED_MEETING_NOTES" } }, { transaction });
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
      await this.repository.recordStatusHistory({
        activityId: id,
        fromStatusCode: current.statusCode,
        toStatusCode: updated.statusCode,
        reason: parsed.data.reason,
        outcome: parsed.data.outcome || null,
        actorId: actor.id,
        correlationId,
      }, transaction);
      await this.audit.append({ actorId: actor.id, action: "activity.transition", targetType: "Activity", targetId: id, targetVersion: String(updated.version), outcome: "SUCCESS", correlationId, reason: parsed.data.reason, data: { fromStatusCode: current.statusCode, toStatusCode: updated.statusCode, completionOutcome: parsed.data.outcome || null } }, { transaction });
      return updated;
    });
  }

  private async hasPermission(actor: ActivityActor, permission: Permission, transaction: ActivityTransaction) {
    return this.permissions.allows(actor, permission) || this.repository.actorHasPermission(actor.id, permission, transaction);
  }
}

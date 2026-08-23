import { ActivityType } from "@prisma/client";
import { z } from "zod";

import type { AuditWriter } from "../audit/audit-writer";
import { PERMISSIONS } from "../authorization/permission-policy";
import { ProspectAccessError, requireProspectPermission } from "./prospect-authorization";
import type { PrismaProspectRepository, ProspectTransaction } from "./prospect-repository";
import type { ProspectActor } from "./prospect-service";
import { ProspectValidationError, ProspectVersionConflictError } from "./prospect-service";

const updateSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  activityType: z.enum(ActivityType),
  subject: z.string().trim().min(2).max(255),
  description: z.string().trim().max(10_000).nullable().optional(),
  nextFollowUpAt: z.coerce.date().nullable().optional(),
});

const deleteSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(5).max(1000),
});

export class ProspectActivityService {
  constructor(
    private readonly repository: PrismaProspectRepository,
    private readonly audit: AuditWriter<ProspectTransaction>,
  ) {}

  async update(actor: ProspectActor, prospectId: string, activityId: string, input: unknown, correlationId: string, idempotencyKey: string) {
    requireProspectPermission(actor.permissions, PERMISSIONS.prospectUpdate);
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) throw new ProspectValidationError(parsed.error.flatten().fieldErrors);

    return this.repository.transaction(async (transaction) => {
      const prospect = await this.repository.findAccessible(prospectId, actor.authorization, actor.permissions, transaction);
      if (!prospect) throw new ProspectAccessError();
      const command = `prospect.activity.update.${activityId}`;
      const receipt = await this.repository.findReceipt(actor.id, idempotencyKey, command, transaction);
      if (receipt) {
        const replay = await transaction.activity.findFirst({ where: { id: activityId, prospectId, deletedAt: null } });
        if (!replay) throw new ProspectAccessError();
        return replay;
      }
      const current = await transaction.activity.findFirst({
        where: { id: activityId, prospectId, deletedAt: null },
        select: { id: true, version: true, type: true },
      });
      if (!current) throw new ProspectAccessError();

      const description = parsed.data.description || null;
      const nextFollowUpAt = parsed.data.nextFollowUpAt ?? null;
      const updated = await transaction.activity.updateMany({
        where: { id: activityId, prospectId, version: parsed.data.expectedVersion, deletedAt: null },
        data: {
          type: parsed.data.activityType,
          subject: parsed.data.subject,
          description,
          notes: description,
          nextFollowUpAt,
          dueAt: nextFollowUpAt,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new ProspectVersionConflictError();

      const activity = await transaction.activity.findUniqueOrThrow({ where: { id: activityId } });
      await this.audit.append({
        actorId: actor.id,
        action: "prospect.activity.update",
        targetType: "Activity",
        targetId: activityId,
        targetVersion: String(activity.version),
        outcome: "SUCCESS",
        correlationId,
        data: { prospectId, previousVersion: current.version, fromType: current.type, toType: activity.type },
      }, { transaction });
      await this.repository.saveReceipt({ actorId: actor.id, key: idempotencyKey, command, prospectId, version: activity.version }, transaction);
      return activity;
    });
  }

  async remove(actor: ProspectActor, prospectId: string, activityId: string, input: unknown, correlationId: string, idempotencyKey: string) {
    requireProspectPermission(actor.permissions, PERMISSIONS.prospectUpdate);
    const parsed = deleteSchema.safeParse(input);
    if (!parsed.success) throw new ProspectValidationError(parsed.error.flatten().fieldErrors);

    return this.repository.transaction(async (transaction) => {
      const prospect = await this.repository.findAccessible(prospectId, actor.authorization, actor.permissions, transaction);
      if (!prospect) throw new ProspectAccessError();
      const command = `prospect.activity.delete.${activityId}`;
      const receipt = await this.repository.findReceipt(actor.id, idempotencyKey, command, transaction);
      if (receipt) return { id: activityId, deleted: true, version: receipt.resultVersion };
      const current = await transaction.activity.findFirst({
        where: { id: activityId, prospectId, deletedAt: null },
        select: { id: true, version: true },
      });
      if (!current) throw new ProspectAccessError();

      const deletedAt = new Date();
      const deleted = await transaction.activity.updateMany({
        where: { id: activityId, prospectId, version: parsed.data.expectedVersion, deletedAt: null },
        data: { deletedAt, deletedById: actor.id, version: { increment: 1 } },
      });
      if (deleted.count !== 1) throw new ProspectVersionConflictError();

      const version = current.version + 1;
      await this.audit.append({
        actorId: actor.id,
        action: "prospect.activity.delete",
        targetType: "Activity",
        targetId: activityId,
        targetVersion: String(version),
        outcome: "SUCCESS",
        correlationId,
        reason: parsed.data.reason,
        data: { prospectId, previousVersion: current.version },
      }, { transaction });
      await this.repository.saveReceipt({ actorId: actor.id, key: idempotencyKey, command, prospectId, version }, transaction);
      return { id: activityId, deleted: true, deletedAt, version };
    });
  }
}

import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

import type { AuditWriter } from "../audit/audit-writer";
import type { AuthorizationContext } from "../authorization/authorization-context";
import { PERMISSIONS, type Permission } from "../authorization/permission-policy";
import { buildCustomerScopeWhere } from "../customer/customer-query-service";
import { buildProspectScopeWhere } from "../prospect/prospect-authorization";
import { PROSPECT_DELETE_REASONS } from "./data-retention-policy";

const softDeleteSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  reason: z.enum(PROSPECT_DELETE_REASONS),
});
const versionSchema = z.strictObject({ expectedVersion: z.number().int().positive() });
const customerLifecycleSchema = z.strictObject({ expectedVersion: z.number().int().positive(), status: z.enum(["INACTIVE", "BLACKLISTED", "CLOSED"]), reason: z.string().trim().min(3).max(1000) });

export type DataRetentionActor = { id: string; authorization: AuthorizationContext };
type Tx = Prisma.TransactionClient;

export class DataRetentionValidationError extends Error {
  constructor(readonly issues?: Record<string, string[]>) { super("Data-retention input is invalid."); this.name = "DataRetentionValidationError"; }
}
export class DataRetentionAccessError extends Error {
  constructor() { super("Data-retention action is not available."); this.name = "DataRetentionAccessError"; }
}
export class DataRetentionVersionConflictError extends Error {
  constructor() { super("Record version is stale."); this.name = "DataRetentionVersionConflictError"; }
}
export class PermanentDeleteBlockedError extends Error {
  constructor(readonly references: readonly string[]) { super("Permanent delete is blocked by retained references."); this.name = "PermanentDeleteBlockedError"; }
}

export class DataRetentionService {
  constructor(private readonly prisma: PrismaClient, private readonly audit: AuditWriter<Tx>) {}

  private async permissions(actor: DataRetentionActor, transaction: Tx) {
    const roles = [...new Set(actor.authorization.assignments.map(item => item.role))];
    const grants = await transaction.rolePermissionGrant.findMany({ where: { roleCode: { in: roles } }, select: { permissionCode: true } });
    return new Set(grants.map(item => item.permissionCode));
  }

  private async authorize(actor: DataRetentionActor, permission: Permission, transaction: Tx) {
    const permissions = await this.permissions(actor, transaction);
    if (!permissions.has(permission)) throw new DataRetentionAccessError();
    return permissions;
  }

  async softDeleteProspect(actor: DataRetentionActor, prospectId: string, input: unknown, correlationId: string) {
    const parsed = softDeleteSchema.safeParse(input);
    if (!parsed.success) throw new DataRetentionValidationError(parsed.error.flatten().fieldErrors);
    return this.prisma.$transaction(async transaction => {
      const permissions = await this.authorize(actor, PERMISSIONS.prospectSoftDelete, transaction);
      const current = await transaction.prospect.findFirst({ where: { id: prospectId, ...buildProspectScopeWhere(actor.authorization, permissions) }, select: { id: true, version: true, status: true } });
      if (!current) throw new DataRetentionAccessError();
      const result = await transaction.prospect.updateMany({ where: { id: prospectId, version: parsed.data.expectedVersion, deletedAt: null }, data: { deletedAt: new Date(), deletedById: actor.id, deleteReason: parsed.data.reason, updatedById: actor.id, version: { increment: 1 } } });
      if (result.count !== 1) throw new DataRetentionVersionConflictError();
      const updated = await transaction.prospect.findUniqueOrThrow({ where: { id: prospectId }, select: { id: true, version: true, status: true, deletedAt: true, deleteReason: true } });
      await this.audit.append({ actorId: actor.id, action: "prospect.soft-delete", targetType: "Prospect", targetId: prospectId, targetVersion: String(updated.version), outcome: "SUCCESS", correlationId, reason: parsed.data.reason, data: { oldStatus: current.status, newStatus: current.status, recoverable: true } }, { transaction });
      return updated;
    });
  }

  async restoreProspect(actor: DataRetentionActor, prospectId: string, input: unknown, correlationId: string) {
    const parsed = versionSchema.safeParse(input);
    if (!parsed.success) throw new DataRetentionValidationError(parsed.error.flatten().fieldErrors);
    return this.prisma.$transaction(async transaction => {
      await this.authorize(actor, PERMISSIONS.prospectRestore, transaction);
      const current = await transaction.prospect.findFirst({ where: { id: prospectId, deletedAt: { not: null } }, select: { version: true, status: true, deleteReason: true } });
      if (!current) throw new DataRetentionAccessError();
      const result = await transaction.prospect.updateMany({ where: { id: prospectId, version: parsed.data.expectedVersion, deletedAt: { not: null } }, data: { deletedAt: null, deletedById: null, deleteReason: null, updatedById: actor.id, version: { increment: 1 } } });
      if (result.count !== 1) throw new DataRetentionVersionConflictError();
      const restored = await transaction.prospect.findUniqueOrThrow({ where: { id: prospectId }, select: { id: true, version: true, status: true } });
      await this.audit.append({ actorId: actor.id, action: "prospect.restore", targetType: "Prospect", targetId: prospectId, targetVersion: String(restored.version), outcome: "SUCCESS", correlationId, reason: current.deleteReason ?? undefined, data: { oldStatus: current.status, newStatus: restored.status } }, { transaction });
      return restored;
    });
  }

  async permanentlyDeleteProspect(actor: DataRetentionActor, prospectId: string, input: unknown, correlationId: string) {
    const parsed = versionSchema.safeParse(input);
    if (!parsed.success) throw new DataRetentionValidationError(parsed.error.flatten().fieldErrors);
    return this.prisma.$transaction(async transaction => {
      await this.authorize(actor, PERMISSIONS.prospectPermanentDelete, transaction);
      const current = await transaction.prospect.findFirst({ where: { id: prospectId, version: parsed.data.expectedVersion, deletedAt: { not: null } }, select: { id: true, prospectCode: true, version: true } });
      if (!current) throw new DataRetentionAccessError();
      const [activities, documents, convertedLead, statusHistory, assignmentHistory, receipts, mergeHistory, auditReferences] = await Promise.all([
        transaction.activity.count({ where: { prospectId } }),
        transaction.salesDocument.count({ where: { prospectId } }),
        transaction.lead.count({ where: { sourceProspect: { id: prospectId } } }),
        transaction.prospectStatusHistory.count({ where: { prospectId } }),
        transaction.prospectAssignmentHistory.count({ where: { prospectId } }),
        transaction.prospectCommandReceipt.count({ where: { prospectId } }),
        transaction.prospectMergeHistory.count({ where: { OR: [{ sourceProspectId: prospectId }, { targetProspectId: prospectId }] } }),
        transaction.auditEvent.count({ where: { targetType: "Prospect", targetId: prospectId } }),
      ]);
      const references = [activities ? "ACTIVITY" : null, documents ? "DOCUMENT" : null, convertedLead ? "LEAD_OR_OPPORTUNITY" : null, statusHistory || assignmentHistory || receipts || mergeHistory ? "WORKFLOW" : null, auditReferences ? "AUDIT_REFERENCE" : null].filter((value): value is string => Boolean(value));
      if (references.length) throw new PermanentDeleteBlockedError(references);
      await transaction.prospectImportRow.updateMany({ where: { prospectId }, data: { prospectId: null } });
      await transaction.prospectContact.deleteMany({ where: { prospectId } });
      await transaction.prospect.delete({ where: { id: prospectId } });
      await this.audit.append({ actorId: actor.id, action: "prospect.permanent-delete", targetType: "Prospect", targetId: prospectId, targetVersion: String(current.version), outcome: "SUCCESS", correlationId, reason: "SYSTEM_ADMIN_APPROVED_NO_REFERENCES", data: { prospectCode: current.prospectCode } }, { transaction });
      return { id: prospectId, permanentlyDeleted: true as const };
    });
  }

  async changeCustomerLifecycle(actor: DataRetentionActor, customerId: string, input: unknown, correlationId: string) {
    const parsed=customerLifecycleSchema.safeParse(input);if(!parsed.success)throw new DataRetentionValidationError(parsed.error.flatten().fieldErrors);
    return this.prisma.$transaction(async transaction=>{
      await this.authorize(actor,PERMISSIONS.customerLifecycleManage,transaction);
      const scope=buildCustomerScopeWhere(actor.authorization);const current=await transaction.customer.findFirst({where:{id:customerId,mergedIntoCustomerId:null,...scope},select:{version:true,status:true}});if(!current)throw new DataRetentionAccessError();
      const result=await transaction.customer.updateMany({where:{id:customerId,version:parsed.data.expectedVersion,mergedIntoCustomerId:null,...scope},data:{status:parsed.data.status,version:{increment:1}}});if(result.count!==1)throw new DataRetentionVersionConflictError();
      const updated=await transaction.customer.findUniqueOrThrow({where:{id:customerId},select:{id:true,version:true,status:true}});
      await this.audit.append({actorId:actor.id,action:"customer.lifecycle-change",targetType:"Customer",targetId:customerId,targetVersion:String(updated.version),outcome:"SUCCESS",correlationId,reason:parsed.data.reason,data:{oldStatus:current.status,newStatus:updated.status}},{transaction});
      return updated;
    });
  }
}

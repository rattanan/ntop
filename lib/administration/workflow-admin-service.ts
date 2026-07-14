import { createHash } from "node:crypto";
import type { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import type { AuditWriter } from "../audit/audit-writer";
import { AUTHORIZATION_SCOPES, ENTERPRISE_ROLES } from "../authorization/enterprise-role-policy";
import { assertPermission, PERMISSIONS, type PermissionPolicy, permissionPolicy } from "../authorization/permission-policy";

export const transitionPolicySchema = z.strictObject({ policyCode: z.string().trim().min(1).max(100), command: z.string().trim().min(1).max(32), fromStage: z.enum(["QUALIFY", "DISCOVER", "SOLUTION", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "CANCELLED"]), toStage: z.enum(["QUALIFY", "DISCOVER", "SOLUTION", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "CANCELLED"]), requiredFields: z.array(z.string().trim().min(1).max(100)).max(30), requiredPermission: z.string().trim().min(1).max(191), effectiveFrom: z.date(), effectiveTo: z.date().nullable() });
export const approvalPolicySchema = z.strictObject({ code: z.string().trim().min(1).max(100), definition: z.record(z.string(), z.unknown()), effectiveFrom: z.date(), effectiveTo: z.date().nullable() });
export const authorityGrantSchema = z.strictObject({ roleCode: z.string().trim().min(1).max(100), permissionCode: z.string().trim().min(1).max(191), organizationUnitId: z.string().trim().min(1).nullable(), customerSegment: z.string().trim().min(1).max(100).nullable(), maximumAmount: z.string().regex(/^\d+(\.\d{1,4})?$/), effectiveFrom: z.date(), effectiveTo: z.date().nullable() });
export const roleAssignmentSchema = z.strictObject({ userId: z.string().min(1), roleCode: z.enum(ENTERPRISE_ROLES), scopeCode: z.enum(AUTHORIZATION_SCOPES), organizationUnitId: z.string().min(1).nullable(), effectiveFrom: z.date(), effectiveTo: z.date().nullable() });
export const productCostSchema = z.strictObject({ productId: z.string().min(1), standardCost: z.string().regex(/^\d+(\.\d{1,4})?$/), confirmedAt: z.date() });

type Actor = { id: string; role: Role };
type Tx = Prisma.TransactionClient;
type Repository = { transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> };

export class WorkflowAdminService {
  constructor(private readonly repository: Repository, private readonly audit: AuditWriter<Tx>, private readonly policy: PermissionPolicy = permissionPolicy) {}

  private async run<T>(actor: Actor, action: string, targetType: string, correlationId: string, work: (tx: Tx) => Promise<{ id: string; version?: number; value: T }>) {
    assertPermission(actor, PERMISSIONS.workflowConfigManage, this.policy);
    return this.repository.transaction(async (tx) => {
      const result = await work(tx);
      await this.audit.append({ actorId: actor.id, action, targetType, targetId: result.id, targetVersion: result.version ? String(result.version) : undefined, outcome: "SUCCESS", correlationId }, { transaction: tx });
      return result.value;
    });
  }

  createTransitionPolicy(actor: Actor, input: unknown, correlationId: string) {
    const data = transitionPolicySchema.parse(input);
    return this.run(actor, "workflow.transition-policy.version.create", "OpportunityTransitionPolicyVersion", correlationId, async (tx) => {
      const last = await tx.opportunityTransitionPolicyVersion.findFirst({ where: { policyCode: data.policyCode }, orderBy: { version: "desc" }, select: { version: true } });
      await tx.opportunityTransitionPolicyVersion.updateMany({ where: { policyCode: data.policyCode, active: true }, data: { active: false, effectiveTo: data.effectiveFrom } });
      const row = await tx.opportunityTransitionPolicyVersion.create({ data: { ...data, version: (last?.version ?? 0) + 1, requiredFields: data.requiredFields }, select: { id: true, version: true } });
      return { ...row, value: row };
    });
  }

  createApprovalPolicy(actor: Actor, input: unknown, correlationId: string) {
    const data = approvalPolicySchema.parse(input);
    return this.run(actor, "workflow.approval-policy.version.create", "ApprovalPolicyVersion", correlationId, async (tx) => {
      const policy = await tx.approvalPolicy.upsert({ where: { code: data.code }, create: { code: data.code }, update: {} });
      const last = await tx.approvalPolicyVersion.findFirst({ where: { policyId: policy.id }, orderBy: { version: "desc" }, select: { version: true } });
      const version = (last?.version ?? 0) + 1;
      const definitionHash = createHash("sha256").update(JSON.stringify(data.definition)).digest("hex");
      const row = await tx.approvalPolicyVersion.create({ data: { policyId: policy.id, version, definition: data.definition as Prisma.InputJsonValue, definitionHash, effectiveFrom: data.effectiveFrom, effectiveTo: data.effectiveTo } });
      await tx.approvalPolicy.update({ where: { id: policy.id }, data: { activeVersionId: row.id } });
      return { id: row.id, version, value: row };
    });
  }

  createAuthorityGrant(actor: Actor, input: unknown, correlationId: string) {
    const data = authorityGrantSchema.parse(input);
    return this.run(actor, "workflow.authority-grant.create", "ApprovalAuthorityGrant", correlationId, async (tx) => { const row = await tx.approvalAuthorityGrant.create({ data }); return { id: row.id, value: row }; });
  }

  createRoleAssignment(actor: Actor, input: unknown, correlationId: string) {
    assertPermission(actor, PERMISSIONS.workflowConfigManage, this.policy);
    const data = roleAssignmentSchema.parse(input);
    if (data.userId === actor.id) throw new Error("Role self-assignment requires a different administrator.");
    return this.run(actor, "authorization.role-assignment.create", "UserRoleAssignment", correlationId, async (tx) => { const row = await tx.userRoleAssignment.create({ data }); return { id: row.id, value: row }; });
  }

  confirmProductCost(actor: Actor, input: unknown, correlationId: string) {
    const data = productCostSchema.parse(input);
    return this.run(actor, "product.cost.confirm", "Product", correlationId, async (tx) => { const row = await tx.product.update({ where: { id: data.productId }, data: { standardCost: data.standardCost, costConfirmedAt: data.confirmedAt } }); return { id: row.id, value: row }; });
  }
}

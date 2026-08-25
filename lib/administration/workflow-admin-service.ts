import { createHash } from "node:crypto";
import { Prisma, type Role } from "@prisma/client";
import { z } from "zod";
import { APPROVAL_MODES, APPROVAL_WORKFLOW_CODES, approvalDefinitionHasSteps } from "../approval/approval-control";
import type { AuditWriter } from "../audit/audit-writer";
import type { AuditJsonValue } from "../audit/redact-audit-data";
import { AUTHORIZATION_SCOPES, ENTERPRISE_ROLES } from "../authorization/enterprise-role-policy";
import { assertPermission, PERMISSIONS, type PermissionPolicy, permissionPolicy } from "../authorization/permission-policy";

export const transitionPolicySchema = z.strictObject({ policyCode: z.string().trim().min(1).max(100), command: z.string().trim().min(1).max(32), fromStage: z.enum(["QUALIFY", "DISCOVER", "SOLUTION", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "CANCELLED"]), toStage: z.enum(["QUALIFY", "DISCOVER", "SOLUTION", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "CANCELLED"]), requiredFields: z.array(z.string().trim().min(1).max(100)).max(30), requiredPermission: z.string().trim().min(1).max(191), effectiveFrom: z.date(), effectiveTo: z.date().nullable() });
export const approvalPolicySchema = z.strictObject({ code: z.string().trim().min(1).max(100), definition: z.record(z.string(), z.unknown()), effectiveFrom: z.date(), effectiveTo: z.date().nullable() });
export const authorityGrantSchema = z.strictObject({ roleCode: z.string().trim().min(1).max(100), permissionCode: z.string().trim().min(1).max(191), organizationUnitId: z.string().trim().min(1).nullable(), customerSegment: z.string().trim().min(1).max(100).nullable(), maximumAmount: z.string().regex(/^\d+(\.\d{1,4})?$/), effectiveFrom: z.date(), effectiveTo: z.date().nullable() });
export const authorityGrantDeactivateSchema = z.strictObject({ grantId: z.string().trim().min(1) });
export const roleAssignmentSchema = z.strictObject({ userId: z.string().min(1), roleCode: z.enum(ENTERPRISE_ROLES), scopeCode: z.enum(AUTHORIZATION_SCOPES), organizationUnitId: z.string().min(1).nullable(), effectiveFrom: z.date(), effectiveTo: z.date().nullable() });
export const productCostSchema = z.strictObject({ productId: z.string().min(1), standardCost: z.string().regex(/^\d+(\.\d{1,4})?$/), confirmedAt: z.date() });
export const approvalSystemModeSchema = z.strictObject({ mode: z.enum(APPROVAL_MODES), expectedVersion: z.number().int().positive(), reason: z.string().trim().min(5).max(1000) });
export const approvalWorkflowModeSchema = z.strictObject({ workflowCode: z.enum(APPROVAL_WORKFLOW_CODES), mode: z.enum(APPROVAL_MODES), expectedVersion: z.number().int().positive(), reason: z.string().trim().min(5).max(1000) });
export const amountApprovalPolicySchema = z.strictObject({ workflowCode: z.enum(APPROVAL_WORKFLOW_CODES), requiredPermission: z.string().trim().min(1).max(191), tier1Maximum: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(), tier2Maximum: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(), tier1RoleCode: z.string().trim().min(1).max(100), tier2RoleCode: z.string().trim().min(1).max(100).optional(), tier3RoleCode: z.string().trim().min(1).max(100).optional(), makerChecker: z.boolean(), effectiveFrom: z.date(), effectiveTo: z.date().nullable() });

type Actor = { id: string; role: Role };
type Tx = Prisma.TransactionClient;
type Repository = { transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> };

export class WorkflowAdminService {
  constructor(private readonly repository: Repository, private readonly audit: AuditWriter<Tx>, private readonly policy: PermissionPolicy = permissionPolicy) {}

  private async run<T>(actor: Actor, action: string, targetType: string, correlationId: string, work: (tx: Tx) => Promise<{ id: string; version?: number; value: T; reason?: string; data?: { [key: string]: AuditJsonValue } }>) {
    assertPermission(actor, PERMISSIONS.workflowConfigManage, this.policy);
    return this.repository.transaction(async (tx) => {
      const result = await work(tx);
      await this.audit.append({ actorId: actor.id, action, targetType, targetId: result.id, targetVersion: result.version ? String(result.version) : undefined, outcome: "SUCCESS", correlationId, reason: result.reason, data: result.data }, { transaction: tx });
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

  updateApprovalSystemMode(actor: Actor, input: unknown, correlationId: string) {
    const data = approvalSystemModeSchema.parse(input);
    return this.run(actor, "approval.system.mode.update", "ApprovalSystemConfiguration", correlationId, async (tx) => {
      const changed = await tx.approvalSystemConfiguration.updateMany({ where: { id: "approval_system", version: data.expectedVersion }, data: { mode: data.mode, version: { increment: 1 }, reason: data.reason, updatedById: actor.id } });
      if (!changed.count) throw new Error("Approval system configuration changed concurrently.");
      const row = await tx.approvalSystemConfiguration.findUniqueOrThrow({ where: { id: "approval_system" } });
      return { id: row.id, version: row.version, value: row, reason: data.reason, data: { mode: data.mode } };
    });
  }

  updateApprovalWorkflowMode(actor: Actor, input: unknown, correlationId: string) {
    const data = approvalWorkflowModeSchema.parse(input);
    return this.run(actor, "approval.workflow.mode.update", "ApprovalWorkflowConfiguration", correlationId, async (tx) => {
      const current = await tx.approvalWorkflowConfiguration.findUnique({ where: { code: data.workflowCode }, include: { policy: { include: { activeVersion: true } } } });
      if (!current) throw new Error("Approval workflow configuration is unavailable.");
      if (data.mode === "ENFORCED" && (!current.policy.activeVersion || !approvalDefinitionHasSteps(current.policy.activeVersion.definition))) throw new Error("Publish a policy with at least one approver step before enabling this workflow.");
      const changed = await tx.approvalWorkflowConfiguration.updateMany({ where: { id: current.id, version: data.expectedVersion }, data: { mode: data.mode, version: { increment: 1 }, reason: data.reason, updatedById: actor.id } });
      if (!changed.count) throw new Error("Approval workflow configuration changed concurrently.");
      const row = await tx.approvalWorkflowConfiguration.findUniqueOrThrow({ where: { id: current.id } });
      return { id: row.id, version: row.version, value: row, reason: data.reason, data: { workflowCode: data.workflowCode, mode: data.mode } };
    });
  }

  createAmountApprovalPolicy(actor: Actor, input: unknown, correlationId: string) {
    const data = amountApprovalPolicySchema.parse(input);
    return this.run(actor, "approval.policy.version.publish", "ApprovalPolicyVersion", correlationId, async (tx) => {
      const workflow = await tx.approvalWorkflowConfiguration.findUnique({ where: { code: data.workflowCode }, include: { policy: true } });
      if (!workflow) throw new Error("Approval workflow configuration is unavailable.");
      const step = (code: string, roleCode: string, maximumAuthority?: string) => ({ code, sequence: 1, executionMode: "SEQUENTIAL", requiredPermission: data.requiredPermission, assignedRoleCode: roleCode, ...(maximumAuthority ? { maximumAuthority } : {}), makerChecker: data.makerChecker });
      let definition: Prisma.InputJsonObject;
      if (workflow.amountSource) {
        if (!data.tier1Maximum || !data.tier2Maximum || !data.tier2RoleCode || !data.tier3RoleCode) throw new Error("Monetary approval requires all three tiers.");
        if (new Prisma.Decimal(data.tier1Maximum).gte(new Prisma.Decimal(data.tier2Maximum))) throw new Error("Tier 1 maximum must be below Tier 2 maximum.");
        definition = {
          rules: [
            { code: "T3", when: [{ field: "total", operator: "GT", value: data.tier2Maximum }], steps: [step("tier-3", data.tier3RoleCode)] },
            { code: "T2", when: [{ field: "total", operator: "GT", value: data.tier1Maximum }, { field: "total", operator: "LTE", value: data.tier2Maximum }], steps: [step("tier-2", data.tier2RoleCode, data.tier2Maximum)] },
          ],
          fallbackSteps: [step("tier-1", data.tier1RoleCode, data.tier1Maximum)],
        } as Prisma.InputJsonObject;
      } else {
        definition = { rules: [], fallbackSteps: [step("reviewer", data.tier1RoleCode)] } as Prisma.InputJsonObject;
      }
      const last = await tx.approvalPolicyVersion.findFirst({ where: { policyId: workflow.policyId }, orderBy: { version: "desc" }, select: { version: true } });
      const version = (last?.version ?? 0) + 1;
      const definitionHash = createHash("sha256").update(JSON.stringify(definition)).digest("hex");
      const row = await tx.approvalPolicyVersion.create({ data: { policyId: workflow.policyId, version, definition, definitionHash, effectiveFrom: data.effectiveFrom, effectiveTo: data.effectiveTo } });
      await tx.approvalPolicy.update({ where: { id: workflow.policyId }, data: { activeVersionId: row.id } });
      return { id: row.id, version, value: row, data: { workflowCode: data.workflowCode, definitionHash } };
    });
  }

  createAuthorityGrant(actor: Actor, input: unknown, correlationId: string) {
    const data = authorityGrantSchema.parse(input);
    return this.run(actor, "workflow.authority-grant.create", "ApprovalAuthorityGrant", correlationId, async (tx) => { const row = await tx.approvalAuthorityGrant.create({ data }); return { id: row.id, value: row }; });
  }

  deactivateAuthorityGrant(actor: Actor, input: unknown, correlationId: string) {
    const data = authorityGrantDeactivateSchema.parse(input);
    return this.run(actor, "approval.authority-grant.deactivate", "ApprovalAuthorityGrant", correlationId, async (tx) => {
      const changed = await tx.approvalAuthorityGrant.updateMany({ where: { id: data.grantId, active: true }, data: { active: false } });
      if (!changed.count) throw new Error("Approval authority grant is unavailable.");
      return { id: data.grantId, value: { id: data.grantId, active: false } };
    });
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

import { createHash } from "node:crypto";

import type { Role } from "@prisma/client";

import type { AuditWriter } from "../audit/audit-writer";
import type { AuthorizationContext } from "../authorization/authorization-context";
import { decimal } from "./decimal-money";

export type ApprovalAction = "APPROVE" | "REJECT" | "RETURN" | "DELEGATE" | "ESCALATE";

export type ApprovalRequestRecord = {
  id: string;
  version: number;
  status: string;
  makerId: string;
  quoteVersionId: string;
  quoteTotal: string;
  customerSegment: string;
  organizationUnitId: string | null;
  quoteVersionHash: string;
  step: {
    id: string;
    stepCode: string;
    requiredPermission: string;
    assignedRoleCode: string | null;
    delegatedToActorId: string | null;
    makerChecker: boolean;
    minimumAuthority: string | null;
    maximumAuthority: string | null;
    status: string;
  };
  policyInputSnapshot: Record<string, unknown>;
  previousDecisionHash: string | null;
};

export interface ApprovalRepository<TTransaction> {
  transaction<T>(work: (transaction: TTransaction) => Promise<T>): Promise<T>;
  findReceipt(actorId: string, key: string, command: string, transaction: TTransaction): Promise<{ targetId: string } | null>;
  saveReceipt(input: { actorId: string; idempotencyKey: string; command: string; targetId: string; resultVersion: number | null }, transaction: TTransaction): Promise<void>;
  findActionable(input: { requestId: string; stepId: string; context: AuthorizationContext }, transaction: TTransaction): Promise<ApprovalRequestRecord | null>;
  findAuthority(input: { roleCodes: readonly string[]; permissionCode: string; organizationUnitId: string | null; customerSegment: string; at: Date }, transaction: TTransaction): Promise<{ id: string; roleCode: string; maximumAmount: string } | null>;
  findDelegate(input: { actorId: string; permissionCode: string; organizationUnitId: string | null; customerSegment: string; at: Date }, transaction: TTransaction): Promise<{ actorId: string; roleCode: string; maximumAmount: string } | null>;
  recordDecision(input: { request: ApprovalRequestRecord; actorId: string; delegateToActorId: string | null; action: ApprovalAction; reason: string; authoritySnapshot: Record<string, unknown>; previousHash: string; decisionHash: string; correlationId: string; decidedAt: Date }, transaction: TTransaction): Promise<{ decisionId: string; requestStatus: string; requestVersion: number }>;
}

type Actor = { id: string; role: Role; authorization: AuthorizationContext };

export class ApprovalAccessError extends Error {
  constructor() { super("Approval request is unavailable."); this.name = "ApprovalAccessError"; }
}
export class ApprovalDecisionDeniedError extends Error {
  constructor() { super("Approval decision is denied."); this.name = "ApprovalDecisionDeniedError"; }
}
export class ApprovalVersionConflictError extends Error {
  constructor() { super("Approval request version is stale."); this.name = "ApprovalVersionConflictError"; }
}

export class ApprovalService<TTransaction> {
  constructor(
    private readonly repository: ApprovalRepository<TTransaction>,
    private readonly auditWriter: AuditWriter<TTransaction>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async decide(
    actor: Actor,
    input: { requestId: string; stepId: string; action: ApprovalAction; reason: string; expectedVersion: number; delegateToActorId?: string },
    correlationId: string,
    idempotencyKey: string,
  ) {
    if (!input.reason.trim()) throw new ApprovalDecisionDeniedError();
    return this.repository.transaction(async (transaction) => {
      const receipt = await this.repository.findReceipt(actor.id, idempotencyKey, "approval.decision", transaction);
      if (receipt) return { decisionId: receipt.targetId };
      const request = await this.repository.findActionable({ requestId: input.requestId, stepId: input.stepId, context: actor.authorization }, transaction);
      if (!request) throw new ApprovalAccessError();
      if (request.version !== input.expectedVersion) throw new ApprovalVersionConflictError();
      if (request.status !== "PENDING" && request.status !== "PENDING_ESCALATION") throw new ApprovalDecisionDeniedError();
      if (request.step.status !== "PENDING" && request.step.status !== "ESCALATED" && request.step.status !== "DELEGATED") throw new ApprovalDecisionDeniedError();
      if (request.step.status === "DELEGATED" && request.step.delegatedToActorId !== actor.id) throw new ApprovalDecisionDeniedError();
      if (request.step.makerChecker && request.makerId === actor.id) throw new ApprovalDecisionDeniedError();
      const roleCodes = actor.authorization.assignments.map((item) => item.role);
      const eligibleRoleCodes = request.step.assignedRoleCode
        ? roleCodes.filter((roleCode) => roleCode === request.step.assignedRoleCode)
        : roleCodes;
      if (!eligibleRoleCodes.length) throw new ApprovalDecisionDeniedError();
      const authority = await this.repository.findAuthority({
        roleCodes: eligibleRoleCodes,
        permissionCode: request.step.requiredPermission,
        organizationUnitId: request.organizationUnitId,
        customerSegment: request.customerSegment,
        at: this.now(),
      }, transaction);
      if (!authority || decimal(authority.maximumAmount).lt(decimal(request.quoteTotal))) {
        throw new ApprovalDecisionDeniedError();
      }
      if (request.step.minimumAuthority && decimal(request.quoteTotal).lt(decimal(request.step.minimumAuthority))) throw new ApprovalDecisionDeniedError();
      if (request.step.maximumAuthority && decimal(request.quoteTotal).gt(decimal(request.step.maximumAuthority))) throw new ApprovalDecisionDeniedError();
      let delegate: { actorId: string; roleCode: string; maximumAmount: string } | null = null;
      if (input.action === "DELEGATE") {
        if (!input.delegateToActorId || input.delegateToActorId === actor.id || input.delegateToActorId === request.makerId) throw new ApprovalDecisionDeniedError();
        delegate = await this.repository.findDelegate({ actorId: input.delegateToActorId, permissionCode: request.step.requiredPermission, organizationUnitId: request.organizationUnitId, customerSegment: request.customerSegment, at: this.now() }, transaction);
        if (!delegate || decimal(delegate.maximumAmount).lt(decimal(request.quoteTotal)) || decimal(delegate.maximumAmount).gt(decimal(authority.maximumAmount))) throw new ApprovalDecisionDeniedError();
      }
      const decidedAt = this.now();
      const previousHash = request.previousDecisionHash ?? request.quoteVersionHash;
      const authoritySnapshot = {
        grantId: authority.id,
        roleCode: authority.roleCode,
        maximumAmount: authority.maximumAmount,
        actorRoles: roleCodes,
        ...(delegate ? { delegate } : {}),
      };
      const decisionHash = createHash("sha256").update(JSON.stringify({ previousHash, requestId: request.id, stepId: request.step.id, actorId: actor.id, action: input.action, reason: input.reason, decidedAt: decidedAt.toISOString() })).digest("hex");
      const result = await this.repository.recordDecision({
        request,
        actorId: actor.id,
        delegateToActorId: delegate?.actorId ?? null,
        action: input.action,
        reason: input.reason.trim(),
        authoritySnapshot,
        previousHash,
        decisionHash,
        correlationId,
        decidedAt,
      }, transaction);
      await this.auditWriter.append({
        actorId: actor.id,
        action: `approval.${input.action.toLowerCase()}`,
        targetType: "ApprovalRequest",
        targetId: request.id,
        targetVersion: String(result.requestVersion),
        outcome: "SUCCESS",
        correlationId,
        reason: input.reason,
        data: { stepId: request.step.id, decisionHash },
      }, { transaction });
      await this.repository.saveReceipt({ actorId: actor.id, idempotencyKey, command: "approval.decision", targetId: result.decisionId, resultVersion: result.requestVersion }, transaction);
      return result;
    });
  }
}

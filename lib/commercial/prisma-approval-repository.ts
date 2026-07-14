import { Prisma, PrismaClient } from "@prisma/client";

import type { AuthorizationContext } from "../authorization/authorization-context";
import { buildOpportunityScopeWhere } from "../opportunity/opportunity-query";
import {
  ApprovalVersionConflictError,
  type ApprovalRepository,
  type ApprovalRequestRecord,
} from "./approval-service";

type Transaction = Prisma.TransactionClient;

function jsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export class PrismaApprovalRepository implements ApprovalRepository<Transaction> {
  constructor(private readonly client: PrismaClient) {}

  transaction<T>(work: (transaction: Transaction) => Promise<T>) {
    return this.client.$transaction(work);
  }

  findReceipt(actorId: string, idempotencyKey: string, command: string, transaction: Transaction) {
    return transaction.commercialCommandReceipt.findUnique({
      where: { actorId_idempotencyKey_command: { actorId, idempotencyKey, command } },
      select: { targetId: true },
    });
  }

  async saveReceipt(input: Parameters<ApprovalRepository<Transaction>["saveReceipt"]>[0], transaction: Transaction) {
    await transaction.commercialCommandReceipt.create({ data: input });
  }

  async findActionable(
    input: { requestId: string; stepId: string; context: AuthorizationContext },
    transaction: Transaction,
  ): Promise<ApprovalRequestRecord | null> {
    const record = await transaction.approvalRequest.findFirst({
      where: {
        id: input.requestId,
        quoteVersion: { quote: { opportunity: buildOpportunityScopeWhere(input.context) } },
      },
      include: {
        quoteVersion: {
          include: {
            quote: {
              include: {
                opportunity: { include: { customer: { select: { segment: true } } } },
              },
            },
          },
        },
        steps: { where: { id: input.stepId }, take: 1 },
        decisions: { orderBy: { decidedAt: "desc" }, take: 1, select: { decisionHash: true } },
      },
    });
    const step = record?.steps[0];
    const opportunity = record?.quoteVersion.quote.opportunity;
    if (!record || !step || !opportunity) return null;
    return {
      id: record.id,
      version: record.version,
      status: record.status,
      makerId: record.makerId,
      quoteVersionId: record.quoteVersionId,
      quoteTotal: record.quoteVersion.total.toFixed(4),
      customerSegment: opportunity.customer.segment,
      organizationUnitId: opportunity.organizationUnitId,
      quoteVersionHash: record.quoteVersionHash,
      step: {
        id: step.id,
        stepCode: step.stepCode,
        requiredPermission: step.requiredPermission,
        assignedRoleCode: step.assignedRoleCode,
        delegatedToActorId: step.delegatedToActorId,
        makerChecker: step.makerChecker,
        minimumAuthority: step.minimumAuthority?.toFixed(4) ?? null,
        maximumAuthority: step.maximumAuthority?.toFixed(4) ?? null,
        status: step.status,
      },
      policyInputSnapshot: jsonObject(record.inputSnapshot),
      previousDecisionHash: record.decisions[0]?.decisionHash ?? null,
    };
  }

  async findAuthority(
    input: Parameters<ApprovalRepository<Transaction>["findAuthority"]>[0],
    transaction: Transaction,
  ) {
    if (!input.roleCodes.length) return null;
    const record = await transaction.approvalAuthorityGrant.findFirst({
      where: {
        roleCode: { in: [...input.roleCodes] },
        permissionCode: input.permissionCode,
        active: true,
        effectiveFrom: { lte: input.at },
        AND: [
          { OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.at } }] },
          { OR: [{ organizationUnitId: null }, { organizationUnitId: input.organizationUnitId }] },
          { OR: [{ customerSegment: null }, { customerSegment: input.customerSegment }] },
        ],
      },
      orderBy: { maximumAmount: "desc" },
      select: { id: true, roleCode: true, maximumAmount: true },
    });
    return record ? { ...record, maximumAmount: record.maximumAmount.toFixed(4) } : null;
  }

  async findDelegate(
    input: Parameters<ApprovalRepository<Transaction>["findDelegate"]>[0],
    transaction: Transaction,
  ) {
    const assignments = await transaction.userRoleAssignment.findMany({
      where: {
        userId: input.actorId,
        active: true,
        effectiveFrom: { lte: input.at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.at } }],
      },
      select: { roleCode: true },
    });
    const authority = await this.findAuthority({ ...input, roleCodes: assignments.map((item) => item.roleCode) }, transaction);
    return authority ? { actorId: input.actorId, roleCode: authority.roleCode, maximumAmount: authority.maximumAmount } : null;
  }

  async recordDecision(
    input: Parameters<ApprovalRepository<Transaction>["recordDecision"]>[0],
    transaction: Transaction,
  ) {
    const locked = await transaction.approvalRequest.updateMany({
      where: { id: input.request.id, version: input.request.version },
      data: { version: { increment: 1 } },
    });
    if (locked.count !== 1) throw new ApprovalVersionConflictError();
    const decision = await transaction.approvalDecision.create({
      data: {
        requestId: input.request.id,
        stepId: input.request.step.id,
        actorId: input.actorId,
        delegateToActorId: input.delegateToActorId,
        decision: input.action,
        reason: input.reason,
        authoritySnapshot: input.authoritySnapshot as Prisma.InputJsonValue,
        policyInputSnapshot: input.request.policyInputSnapshot as Prisma.InputJsonValue,
        previousHash: input.previousHash,
        decisionHash: input.decisionHash,
        correlationId: input.correlationId,
        decidedAt: input.decidedAt,
      },
      select: { id: true },
    });
    let requestStatus = input.request.status;
    if (input.action === "REJECT" || input.action === "RETURN") {
      requestStatus = input.action === "REJECT" ? "REJECTED" : "RETURNED";
      await transaction.approvalStep.update({
        where: { id: input.request.step.id },
        data: { status: input.action === "REJECT" ? "REJECTED" : "RETURNED" },
      });
      await transaction.approvalRequest.update({
        where: { id: input.request.id },
        data: { status: requestStatus as "REJECTED" | "RETURNED", completedAt: input.decidedAt },
      });
      await transaction.quoteVersion.update({
        where: { id: input.request.quoteVersionId },
        data: { status: input.action === "REJECT" ? "REJECTED" : "RETURNED" },
      });
    } else if (input.action === "DELEGATE" || input.action === "ESCALATE") {
      requestStatus = input.action === "ESCALATE" ? "PENDING_ESCALATION" : "PENDING";
      await transaction.approvalStep.update({
        where: { id: input.request.step.id },
        data: { status: input.action === "DELEGATE" ? "DELEGATED" : "ESCALATED", delegatedToActorId: input.delegateToActorId },
      });
      await transaction.approvalRequest.update({
        where: { id: input.request.id },
        data: { status: requestStatus as "PENDING" | "PENDING_ESCALATION" },
      });
    } else {
      await transaction.approvalStep.update({
        where: { id: input.request.step.id },
        data: { status: "APPROVED" },
      });
      const remainingPending = await transaction.approvalStep.count({
        where: { requestId: input.request.id, status: "PENDING" },
      });
      if (remainingPending === 0) {
        const next = await transaction.approvalStep.findFirst({
          where: { requestId: input.request.id, status: "WAITING" },
          orderBy: [{ sequence: "asc" }, { stepCode: "asc" }],
          select: { sequence: true },
        });
        if (next) {
          await transaction.approvalStep.updateMany({
            where: { requestId: input.request.id, status: "WAITING", sequence: next.sequence },
            data: { status: "PENDING" },
          });
          requestStatus = "PENDING";
        } else {
          requestStatus = "APPROVED";
          await transaction.approvalRequest.update({
            where: { id: input.request.id },
            data: { status: "APPROVED", completedAt: input.decidedAt },
          });
          const quoteVersion = await transaction.quoteVersion.update({
            where: { id: input.request.quoteVersionId },
            data: { status: "APPROVED" },
            select: { quoteId: true },
          });
          await transaction.quote.update({
            where: { id: quoteVersion.quoteId },
            data: { status: "APPROVED", version: { increment: 1 } },
          });
        }
      }
    }
    return { decisionId: decision.id, requestStatus, requestVersion: input.request.version + 1 };
  }
}

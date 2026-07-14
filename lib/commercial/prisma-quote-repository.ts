import { randomUUID } from "node:crypto";

import { Prisma, PrismaClient } from "@prisma/client";

import type { AuthorizationContext } from "../authorization/authorization-context";
import { buildOpportunityScopeWhere } from "../opportunity/opportunity-query";
import type {
  ActiveApprovalPolicy,
  QuoteRepository,
  QuoteVersionRecord,
} from "./quote-service";
import type { ApprovalPolicyDefinition } from "./approval-policy-evaluator";

type Transaction = Prisma.TransactionClient;

function object(value: Prisma.JsonValue): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function policyDefinition(value: Prisma.JsonValue): ApprovalPolicyDefinition | null {
  const candidate = object(value);
  return Array.isArray(candidate.rules) && Array.isArray(candidate.fallbackSteps)
    ? candidate as unknown as ApprovalPolicyDefinition
    : null;
}

const versionInclude = {
  items: true,
  quote: {
    include: {
      opportunity: {
        include: {
          customer: { select: { segment: true } },
          coverageChecks: { select: { status: true, confirmedCost: true } },
          solutionDesign: { select: { id: true } },
          riskSignals: { select: { riskType: true }, take: 20, orderBy: { evaluatedAt: "desc" } },
        },
      },
    },
  },
} as const;

function toVersionRecord(record: Prisma.QuoteVersionGetPayload<{ include: typeof versionInclude }>): QuoteVersionRecord {
  const opportunity = record.quote.opportunity;
  if (!opportunity || !record.quote.makerId) throw new Error("Governed Quote relation is incomplete.");
  const policy = object(record.policyInputSnapshot);
  const discountPct = record.subtotal.isZero()
    ? new Prisma.Decimal(0)
    : record.discountAmount.div(record.subtotal).mul(100).toDecimalPlaces(4);
  return {
    id: record.id,
    quoteId: record.quoteId,
    versionNumber: record.versionNumber,
    status: record.status,
    makerId: record.quote.makerId,
    opportunityId: opportunity.id,
    customerId: opportunity.customerId,
    customerSegment: opportunity.customer.segment,
    coverageConfirmed: opportunity.coverageChecks.some((item) => item.status === "CONFIRMED" && item.confirmedCost !== null),
    solutionComplete: opportunity.solutionDesign !== null,
    opportunityRisk: opportunity.riskSignals.length ? opportunity.riskSignals.map((item) => item.riskType).join(",") : "NONE",
    total: record.total.toFixed(4),
    discountPct: discountPct.toFixed(4),
    grossMarginPct: record.grossMarginPct.toFixed(4),
    productCategories: Array.isArray(policy.productCategories)
      ? policy.productCategories.filter((item): item is string => typeof item === "string")
      : [],
    costConfirmed: policy.costConfirmed === true,
    nonStandardTerms: policy.nonStandardTerms === true,
  };
}

export class PrismaQuoteRepository implements QuoteRepository<Transaction> {
  constructor(private readonly client: PrismaClient) {}

  transaction<T>(work: (transaction: Transaction) => Promise<T>) {
    return this.client.$transaction(work);
  }

  findReceipt(actorId: string, idempotencyKey: string, command: string, transaction: Transaction) {
    return transaction.commercialCommandReceipt.findUnique({
      where: { actorId_idempotencyKey_command: { actorId, idempotencyKey, command } },
      select: { targetId: true, resultVersion: true },
    });
  }

  async saveReceipt(input: Parameters<QuoteRepository<Transaction>["saveReceipt"]>[0], transaction: Transaction) {
    await transaction.commercialCommandReceipt.create({ data: input });
  }

  async findOpportunity(input: { id: string; context: AuthorizationContext }, transaction: Transaction) {
    const result = await transaction.opportunity.findFirst({
      where: { id: input.id, ...buildOpportunityScopeWhere(input.context) },
      include: {
        customer: { select: { segment: true } },
        coverageChecks: { select: { status: true, confirmedCost: true } },
        solutionDesign: { select: { id: true } },
        riskSignals: { select: { riskType: true }, take: 20, orderBy: { evaluatedAt: "desc" } },
      },
    });
    if (!result) return null;
    return {
      id: result.id,
      customerId: result.customerId,
      customerSegment: result.customer.segment,
      coverageConfirmed: result.coverageChecks.some((item) => item.status === "CONFIRMED" && item.confirmedCost !== null),
      solutionComplete: result.solutionDesign !== null,
      opportunityRisk: result.riskSignals.length ? result.riskSignals.map((item) => item.riskType).join(",") : "NONE",
    };
  }

  async findQuote(input: { id: string; context: AuthorizationContext }, transaction: Transaction) {
    const result = await transaction.quote.findFirst({
      where: { id: input.id, opportunity: buildOpportunityScopeWhere(input.context) },
      select: { id: true, opportunityId: true, makerId: true, versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { versionNumber: true } } },
    });
    if (!result?.opportunityId || !result.makerId) return null;
    return { id: result.id, opportunityId: result.opportunityId, makerId: result.makerId, latestVersion: result.versions[0]?.versionNumber ?? 0 };
  }

  async loadProducts(ids: readonly string[], transaction: Transaction) {
    const records = await transaction.product.findMany({
      where: { id: { in: [...ids] }, active: true },
      select: { id: true, code: true, name: true, category: true, listPrice: true, floorPrice: true, standardCost: true, costConfirmedAt: true },
    });
    return records.map((item) => ({
      ...item,
      listPrice: item.listPrice.toFixed(4),
      floorPrice: item.floorPrice?.toFixed(4) ?? null,
      standardCost: item.standardCost?.toFixed(4) ?? null,
      costConfirmed: item.standardCost !== null && item.costConfirmedAt !== null,
    }));
  }

  async createVersion(input: Parameters<QuoteRepository<Transaction>["createVersion"]>[0], transaction: Transaction) {
    const policyInputSnapshot = {
      productCategories: [...new Set(input.products.map((item) => item.category))],
      costConfirmed: input.products.every((item) => item.costConfirmed),
      nonStandardTerms: false,
    };
    const quote = input.draft.quoteId
      ? await transaction.quote.update({
          where: { id: input.draft.quoteId },
          data: { version: { increment: 1 }, status: "DRAFT", updatedAt: new Date() },
        })
      : await transaction.quote.create({
          data: {
            quoteNo: `QT-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
            customerId: input.opportunity.customerId,
            opportunityId: input.opportunity.id,
            makerId: input.actorId,
            status: "DRAFT",
            discountPct: input.calculations.subtotal.isZero()
              ? 0
              : Number(input.calculations.discountAmount.div(input.calculations.subtotal).mul(100).toDecimalPlaces(0).toString()),
            subtotal: input.calculations.subtotal,
            discountValue: input.calculations.discountAmount,
            total: input.calculations.total,
            validUntil: input.draft.validUntil ?? null,
            notes: input.draft.notes ?? null,
          },
        });
    if (input.draft.quoteId) {
      const supersededAt = new Date();
      const approvedVersions = await transaction.quoteVersion.findMany({
        where: { quoteId: quote.id, status: "APPROVED" },
        select: { id: true },
      });
      if (approvedVersions.length) {
        const ids = approvedVersions.map((item) => item.id);
        await transaction.quoteVersion.updateMany({ where: { id: { in: ids } }, data: { status: "SUPERSEDED" } });
        await transaction.approvalRequest.updateMany({ where: { quoteVersionId: { in: ids }, status: "APPROVED" }, data: { status: "SUPERSEDED", supersededAt } });
      }
    }
    if (!input.draft.quoteId) {
      await transaction.opportunity.updateMany({
        where: { id: input.opportunity.id, primaryQuoteId: null },
        data: { primaryQuoteId: quote.id },
      });
    }
    const version = await transaction.quoteVersion.create({
      data: {
        quoteId: quote.id,
        versionNumber: input.versionNumber,
        currency: input.draft.currency,
        subtotal: input.calculations.subtotal,
        discountAmount: input.calculations.discountAmount,
        total: input.calculations.total,
        totalCost: input.calculations.totalCost,
        grossMarginAmount: input.calculations.grossMarginAmount,
        grossMarginPct: input.calculations.grossMarginPct,
        policyInputSnapshot,
        coverageSnapshot: { capturedAt: new Date().toISOString() },
        solutionSnapshot: { capturedAt: new Date().toISOString() },
        validUntil: input.draft.validUntil ?? null,
        notes: input.draft.notes ?? null,
        items: {
          create: input.calculations.lines.map((line) => ({
            productId: line.productId,
            productCode: line.productCode,
            productName: line.productName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountAmount: line.discountAmount,
            unitCost: line.unitCost,
            lineSubtotal: line.lineSubtotal,
            lineTotal: line.lineTotal,
            lineCost: line.lineCost,
            marginAmount: line.marginAmount,
          })),
        },
      },
      include: versionInclude,
    });
    return toVersionRecord(version);
  }

  async findVersion(input: { id: string; context: AuthorizationContext }, transaction: Transaction) {
    const record = await transaction.quoteVersion.findFirst({
      where: { id: input.id, quote: { opportunity: buildOpportunityScopeWhere(input.context) } },
      include: versionInclude,
    });
    return record ? toVersionRecord(record) : null;
  }

  async activeApprovalPolicy(transaction: Transaction): Promise<ActiveApprovalPolicy | null> {
    const record = await transaction.approvalPolicy.findFirst({
      where: { activeVersionId: { not: null } },
      select: { activeVersion: { select: { id: true, definition: true } } },
    });
    if (!record?.activeVersion) return null;
    const definition = policyDefinition(record.activeVersion.definition);
    return definition ? { id: record.activeVersion.id, definition } : null;
  }

  async submitVersion(input: Parameters<QuoteRepository<Transaction>["submitVersion"]>[0], transaction: Transaction) {
    await transaction.quoteVersion.update({
      where: { id: input.version.id },
      data: { status: "SUBMITTED", submittedAt: input.submittedAt },
    });
    await transaction.quote.update({
      where: { id: input.version.quoteId },
      data: { status: "PENDING_APPROVAL", version: { increment: 1 } },
    });
    const firstSequence = Math.min(...input.steps.map((step) => step.sequence));
    const request = await transaction.approvalRequest.create({
      data: {
        quoteVersionId: input.version.id,
        policyVersionId: input.policyVersionId,
        makerId: input.version.makerId,
        status: "PENDING",
        inputSnapshot: { ...input.policyInput, matchedRuleCodes: input.matchedRuleCodes } as Prisma.InputJsonValue,
        quoteVersionHash: input.quoteVersionHash,
        submittedAt: input.submittedAt,
        steps: {
          create: input.steps.map((step) => ({
            stepCode: step.code,
            sequence: step.sequence,
            executionMode: step.executionMode,
            requiredPermission: step.requiredPermission,
            assignedRoleCode: step.assignedRoleCode ?? null,
            minimumAuthority: step.minimumAuthority,
            maximumAuthority: step.maximumAuthority,
            makerChecker: step.makerChecker,
            status: step.sequence === firstSequence ? "PENDING" : "WAITING",
            dueAt: step.slaHours ? new Date(input.submittedAt.getTime() + step.slaHours * 3_600_000) : null,
          })),
        },
      },
      select: { id: true },
    });
    return { requestId: request.id };
  }
}

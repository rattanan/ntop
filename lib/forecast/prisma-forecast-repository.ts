import { Prisma, PrismaClient } from "@prisma/client";

import type { AuthorizationContext } from "../authorization/authorization-context";
import { buildOpportunityScopeWhere } from "../opportunity/opportunity-query";
import type { PipelineFact } from "./forecast-calculator";
import type { ForecastRepository } from "./forecast-service";

type Transaction = Prisma.TransactionClient;

const statusPriority = ["ACCEPTED", "APPROVED", "SUBMITTED"] as const;

export class PrismaForecastRepository implements ForecastRepository<Transaction> {
  constructor(private readonly client: PrismaClient) {}

  transaction<T>(work: (transaction: Transaction) => Promise<T>) {
    return this.client.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async findSnapshot(snapshotKey: string, context: AuthorizationContext, transaction: Transaction) {
    const record = await transaction.forecastSnapshot.findUnique({
      where: { snapshotKey },
      select: { id: true, snapshotKey: true, pipelineAmount: true, weightedAmount: true, createdById: true },
    });
    if (!record) return null;
    const allowed = record.createdById === context.actorId || context.assignments.some((item) => item.scope === "ENTERPRISE");
    return allowed ? { id: record.id, snapshotKey: record.snapshotKey, pipelineAmount: record.pipelineAmount.toFixed(4), weightedAmount: record.weightedAmount.toFixed(4) } : null;
  }

  async listFacts(input: { context: AuthorizationContext; periodStart: Date; periodEnd: Date; cutoffAt: Date }, transaction: Transaction): Promise<PipelineFact[]> {
    const records = await transaction.opportunity.findMany({
      where: {
        ...buildOpportunityScopeWhere(input.context),
        stage: { notIn: ["WON", "LOST", "CANCELLED"] },
        expectedCloseAt: { gte: input.periodStart, lt: input.periodEnd },
        createdAt: { lte: input.cutoffAt },
      },
      include: {
        customer: { select: { name: true, segment: true } },
        owner: { select: { name: true } },
        primaryQuote: {
          include: {
            versions: {
              where: { status: { in: [...statusPriority] } },
              orderBy: { versionNumber: "desc" },
            },
          },
        },
        riskSignals: { select: { riskType: true, triggeringFacts: true }, take: 50, orderBy: { evaluatedAt: "desc" } },
      },
      orderBy: [{ expectedCloseAt: "asc" }, { id: "asc" }],
      take: 10_000,
    });
    return records.map((record) => {
      const versions = record.primaryQuote?.versions ?? [];
      const evidence = statusPriority.flatMap((status) => versions.filter((item) => item.status === status))[0];
      const quality: Record<string, unknown> = {};
      if (!record.expectedCloseAt) quality.expectedCloseAt = "MISSING";
      if (!record.nextAction) quality.nextAction = "MISSING";
      return {
        opportunityId: record.id,
        opportunityNumber: record.opportunityNumber,
        opportunityName: record.name,
        opportunityVersion: record.version,
        ownerId: record.ownerId,
        ownerName: record.owner.name,
        organizationUnitId: record.organizationUnitId,
        customerId: record.customerId,
        customerName: record.customer.name,
        segment: record.customer.segment,
        flow: record.flow,
        stage: record.stage,
        category: record.forecastCategory,
        estimatedValue: record.estimatedValue,
        forecastAmount: evidence?.total ?? record.estimatedValue,
        probability: record.probability,
        amountSource: evidence ? "QUOTE_VERSION" : "OPPORTUNITY",
        sourceQuoteVersionId: evidence?.id ?? null,
        expectedCloseAt: record.expectedCloseAt,
        stageEnteredAt: record.stageEnteredAt,
        riskSnapshot: { signals: record.riskSignals },
        qualitySnapshot: quality,
      };
    });
  }

  async createSnapshot(input: Parameters<ForecastRepository<Transaction>["createSnapshot"]>[0], transaction: Transaction) {
    const calculation = input.calculation as typeof input.calculation & { qualitySnapshot?: Record<string, unknown> };
    const record = await transaction.forecastSnapshot.create({
      data: {
        snapshotKey: input.snapshotKey,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        cutoffAt: input.cutoffAt,
        timezone: input.timezone,
        formulaVersion: input.formulaVersion,
        scopeSnapshot: input.scopeSnapshot as Prisma.InputJsonValue,
        pipelineAmount: calculation.pipelineAmount,
        weightedAmount: calculation.weightedAmount,
        qualitySnapshot: (calculation.qualitySnapshot ?? {}) as Prisma.InputJsonValue,
        createdById: input.createdById,
        items: {
          create: calculation.items.map((item) => ({
            opportunity: { connect: { id: item.opportunityId } },
            opportunityVersion: item.opportunityVersion,
            ownerId: item.ownerId,
            organizationUnitId: item.organizationUnitId,
            customerId: item.customerId,
            segment: item.segment,
            flow: item.flow,
            stage: item.stage,
            category: item.category,
            estimatedValue: item.estimatedValue,
            forecastAmount: item.forecastAmount,
            weightedAmount: item.weightedAmount,
            probability: item.probability,
            amountSource: item.amountSource,
            sourceQuoteVersionId: item.sourceQuoteVersionId,
            expectedCloseAt: item.expectedCloseAt,
            stageEnteredAt: item.stageEnteredAt,
            riskSnapshot: item.riskSnapshot as Prisma.InputJsonValue,
            qualitySnapshot: item.qualitySnapshot as Prisma.InputJsonValue,
          })),
        },
      },
      select: { id: true, snapshotKey: true, pipelineAmount: true, weightedAmount: true },
    });
    return { ...record, pipelineAmount: record.pipelineAmount.toFixed(4), weightedAmount: record.weightedAmount.toFixed(4) };
  }
}

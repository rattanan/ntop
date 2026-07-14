import { createHash } from "node:crypto";

import { Prisma, PrismaClient, type Role } from "@prisma/client";

import type { AuditWriter } from "../audit/audit-writer";
import { evaluateDealRiskRule } from "./deal-risk-evaluator";
import type {
  DealRiskRuleRepository,
  DealRiskRuleVersionView,
} from "./deal-risk-rule-service";

export type DealRiskTransaction = Prisma.TransactionClient;

function jsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toView(record: {
  id: string;
  ruleId: string;
  version: number;
  rule: { code: string };
  riskType: string;
  enabled: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  conditionConfig: Prisma.JsonValue;
  scopeConfig: Prisma.JsonValue;
  severityConfig: Prisma.JsonValue;
}): DealRiskRuleVersionView {
  return {
    id: record.id,
    ruleId: record.ruleId,
    version: record.version,
    code: record.rule.code,
    riskType: record.riskType,
    enabled: record.enabled,
    effectiveFrom: record.effectiveFrom,
    effectiveTo: record.effectiveTo,
    configuration: {
      condition: jsonObject(record.conditionConfig) as DealRiskRuleVersionView["configuration"]["condition"],
      scope: jsonObject(record.scopeConfig) as DealRiskRuleVersionView["configuration"]["scope"],
      severity: jsonObject(record.severityConfig),
    },
  };
}

export class PrismaDealRiskRuleRepository
  implements DealRiskRuleRepository<DealRiskTransaction>
{
  constructor(private readonly client: PrismaClient) {}

  transaction<T>(work: (transaction: DealRiskTransaction) => Promise<T>) {
    return this.client.$transaction(work);
  }

  findRuleByCode(code: string, transaction: DealRiskTransaction) {
    return transaction.dealRiskRule.findUnique({
      where: { code },
      select: { id: true },
    });
  }

  async getLatestVersion(ruleId: string, transaction: DealRiskTransaction) {
    const record = await transaction.dealRiskRuleVersion.findFirst({
      where: { ruleId },
      include: { rule: { select: { code: true } } },
      orderBy: { version: "desc" },
    });
    return record ? toView(record) : null;
  }

  createRule(input: { code: string }, transaction: DealRiskTransaction) {
    return transaction.dealRiskRule.create({
      data: input,
      select: { id: true },
    });
  }

  async createVersion(
    input: Omit<DealRiskRuleVersionView, "id"> & { createdById: string },
    transaction: DealRiskTransaction,
  ) {
    const created = await transaction.dealRiskRuleVersion.create({
      data: {
        ruleId: input.ruleId,
        version: input.version,
        riskType: input.riskType,
        enabled: input.enabled,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        conditionConfig:
          input.configuration.condition as Prisma.InputJsonValue,
        thresholdConfig: { threshold: input.configuration.condition.threshold },
        scopeConfig: input.configuration.scope as Prisma.InputJsonValue,
        severityConfig:
          input.configuration.severity as Prisma.InputJsonValue,
        createdById: input.createdById,
      },
      include: { rule: { select: { code: true } } },
    });
    return toView(created);
  }
}

export async function listDealRiskRuleVersions(client: PrismaClient) {
  const records = await client.dealRiskRuleVersion.findMany({
    include: { rule: { select: { code: true } } },
    orderBy: [{ createdAt: "desc" }, { version: "desc" }],
  });
  return records.map(toView);
}

export async function listOpportunityRiskSignals(
  client: PrismaClient,
  opportunityId: string,
) {
  return client.dealRiskSignal.findMany({
    where: { opportunityId },
    include: {
      ruleVersion: { include: { rule: { select: { code: true } } } },
    },
    orderBy: { evaluatedAt: "desc" },
  });
}

function evaluationKey(input: object) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function evaluateAndPersistOpportunityRisks({
  client,
  auditWriter,
  actor,
  opportunityId,
  correlationId,
  evaluatedAt = new Date(),
}: {
  client: PrismaClient;
  auditWriter: AuditWriter<DealRiskTransaction>;
  actor: { id: string; role: Role };
  opportunityId: string;
  correlationId: string;
  evaluatedAt?: Date;
}) {
  return client.$transaction(async (transaction) => {
    const opportunity = await transaction.opportunity.findFirst({
      where: {
        id: opportunityId,
        ...(actor.role === "ADMIN" ? {} : { ownerId: actor.id }),
      },
      select: {
        id: true,
        stage: true,
        expectedCloseAt: true,
        nextAction: true,
        customer: { select: { segment: true } },
        activities: {
          where: { deletedAt: null },
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!opportunity) throw new Error("Opportunity is unavailable.");

    const records = await transaction.dealRiskRuleVersion.findMany({
      where: {
        enabled: true,
        effectiveFrom: { lte: evaluatedAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: evaluatedAt } }],
      },
      include: { rule: { select: { code: true } } },
      orderBy: [{ ruleId: "asc" }, { version: "desc" }],
    });
    const latest = records.filter(
      (record, index) =>
        index === 0 || records[index - 1].ruleId !== record.ruleId,
    );
    let createdCount = 0;
    for (const record of latest) {
      const view = toView(record);
      const signal = evaluateDealRiskRule({
        rule: {
          id: view.id,
          riskType: view.riskType,
          configuration: view.configuration,
        },
        opportunity: {
          id: opportunity.id,
          stage: opportunity.stage,
          segment: opportunity.customer.segment,
          expectedCloseAt: opportunity.expectedCloseAt,
          lastActivityAt: opportunity.activities[0]?.createdAt ?? null,
          nextAction: opportunity.nextAction,
        },
        evaluatedAt,
      });
      if (!signal) continue;
      const stableFacts = {
        metric: signal.triggeringFacts.metric,
        observedValue: signal.triggeringFacts.observedValue,
        stage: signal.triggeringFacts.stage,
        segment: signal.triggeringFacts.segment,
      };
      const key = evaluationKey({
        ruleVersionId: signal.ruleVersionId,
        thresholdSnapshot: signal.thresholdSnapshot,
        triggeringFacts: stableFacts,
      });
      await transaction.dealRiskSignal.upsert({
        where: {
          opportunityId_ruleVersionId_evaluationKey: {
            opportunityId,
            ruleVersionId: signal.ruleVersionId,
            evaluationKey: key,
          },
        },
        create: {
          ...signal,
          evaluationKey: key,
          thresholdSnapshot:
            signal.thresholdSnapshot as Prisma.InputJsonValue,
          triggeringFacts: signal.triggeringFacts as Prisma.InputJsonValue,
          severitySnapshot:
            signal.severitySnapshot as Prisma.InputJsonValue,
          evaluatedAt,
        },
        update: {},
      });
      createdCount += 1;
    }
    await auditWriter.append(
      {
        actorId: actor.id,
        action: "deal-risk.opportunity.evaluate",
        targetType: "Opportunity",
        targetId: opportunityId,
        outcome: "SUCCESS",
        correlationId,
        data: { evaluatedRuleCount: latest.length, signalCount: createdCount },
      },
      { transaction },
    );
    return { evaluatedRuleCount: latest.length, signalCount: createdCount };
  });
}

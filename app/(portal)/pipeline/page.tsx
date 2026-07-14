import { FiscalPeriodType, RevenueType, SalesTargetStatus, type Prisma } from "@prisma/client";

import { PipelineDashboard } from "@/components/pipeline-dashboard";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { money, ZERO } from "@/lib/commercial/decimal-money";
import { calculateForecast, calculateTargetMetrics } from "@/lib/forecast/forecast-calculator";
import { loadForecastConfig } from "@/lib/forecast/forecast-config";
import { resolveFiscalPeriod, type FiscalPeriodType as PeriodType } from "@/lib/forecast/fiscal-period";
import { PrismaForecastRepository } from "@/lib/forecast/prisma-forecast-repository";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";

const allowedPeriodTypes = new Set<PeriodType>(["MONTH", "QUARTER", "YEAR"]);

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession();
  const context = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const params = await searchParams;
  const rawPeriodType = typeof params.periodType === "string" ? params.periodType : "MONTH";
  const periodType: PeriodType = allowedPeriodTypes.has(rawPeriodType as PeriodType) ? rawPeriodType as PeriodType : "MONTH";
  const config = loadForecastConfig();
  const period = resolveFiscalPeriod(new Date(), periodType, config);
  const repository = new PrismaForecastRepository(prisma);
  const facts = await prisma.$transaction((transaction) => repository.listFacts({ context, periodStart: period.periodStart, periodEnd: period.periodEnd, cutoffAt: new Date() }, transaction));
  const ownerId = typeof params.ownerId === "string" ? params.ownerId : "";
  const category = typeof params.category === "string" ? params.category : "";
  const stage = typeof params.stage === "string" ? params.stage : "";
  const filteredFacts = facts.filter((fact) => (!ownerId || fact.ownerId === ownerId) && (!category || fact.category === category) && (!stage || fact.stage === stage));
  const calculation = calculateForecast(filteredFacts);

  const assignment = context.assignments.find((item) => item.scope !== "SELF") ?? context.assignments[0];
  const targetScope: Prisma.SalesTargetWhereInput = assignment?.scope === "ENTERPRISE"
    ? { userId: session.id }
    : assignment?.organizationUnitId
      ? { OR: [{ teamId: assignment.organizationUnitId }, { departmentId: assignment.organizationUnitId }, { businessUnitId: assignment.organizationUnitId }] }
      : { userId: session.id };
  const targetPeriod: Prisma.SalesTargetWhereInput = periodType === "MONTH"
    ? { periodType: FiscalPeriodType.MONTH, fiscalMonth: period.fiscalMonth }
    : periodType === "QUARTER"
      ? { periodType: FiscalPeriodType.QUARTER, fiscalQuarter: period.fiscalQuarter }
      : { periodType: FiscalPeriodType.YEAR };
  const now = new Date();
  const targets = await prisma.salesTarget.findMany({
    where: { AND: [targetScope, targetPeriod, { fiscalYear: period.fiscalYear, revenueType: RevenueType.TOTAL_REVENUE, currency: config.currency, status: SalesTargetStatus.ACTIVE, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }] },
    select: { targetAmount: true }, take: 100,
  });
  const salesTarget = money(targets.reduce((sum, target) => sum.plus(target.targetAmount), ZERO));
  const wonRecords = await prisma.opportunity.findMany({
    where: { ...buildOpportunityScopeWhere(context), stage: "WON", stageHistory: { some: { toStage: "WON", transitionedAt: { gte: period.periodStart, lt: period.periodEnd } } } },
    select: { estimatedValue: true }, take: 10_000,
  });
  const actualClosedWon = money(wonRecords.reduce((sum, record) => sum.plus(record.estimatedValue), ZERO));
  const targetMetrics = targets.length ? calculateTargetMetrics({ salesTarget, actualClosedWon, currentForecast: calculation.bestCaseAmount.plus(actualClosedWon), openPipeline: calculation.pipelineAmount }) : null;

  return <PipelineDashboard facts={filteredFacts} calculation={calculation} targetMetrics={targetMetrics} period={period} asOf={now} filters={{ periodType, ownerId, category, stage }} />;
}

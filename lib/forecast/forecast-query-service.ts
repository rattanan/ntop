import type { AuthorizationContext } from "../authorization/authorization-context";
import { prisma } from "../prisma";
import { calculateForecast } from "./forecast-calculator";
import { PrismaForecastRepository } from "./prisma-forecast-repository";
import { ForecastValidationError } from "./forecast-service";

function enterprise(context: AuthorizationContext) { return context.assignments.some((item) => item.scope === "ENTERPRISE"); }

export async function listForecastSnapshots(context: AuthorizationContext, limit = 50) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new ForecastValidationError();
  return prisma.forecastSnapshot.findMany({
    where: enterprise(context) ? {} : { createdById: context.actorId },
    select: { id: true, snapshotKey: true, periodStart: true, periodEnd: true, cutoffAt: true, timezone: true, formulaVersion: true, currency: true, pipelineAmount: true, weightedAmount: true, qualitySnapshot: true, createdById: true, createdAt: true, _count: { select: { items: true } } },
    orderBy: [{ cutoffAt: "desc" }, { id: "desc" }], take: limit,
  });
}

export async function getForecastSnapshot(context: AuthorizationContext, id: string) {
  const result = await prisma.forecastSnapshot.findFirst({
    where: { id, ...(enterprise(context) ? {} : { createdById: context.actorId }) },
    include: { items: { orderBy: [{ expectedCloseAt: "asc" }, { opportunityId: "asc" }], take: 10_000 } },
  });
  if (!result) throw new ForecastValidationError();
  return result;
}

export async function currentForecast(context: AuthorizationContext, periodStart: Date, periodEnd: Date) {
  if (!Number.isFinite(periodStart.getTime()) || !Number.isFinite(periodEnd.getTime()) || periodEnd <= periodStart) throw new ForecastValidationError();
  const repository = new PrismaForecastRepository(prisma);
  const facts = await prisma.$transaction((tx) => repository.listFacts({ context, periodStart, periodEnd, cutoffAt: new Date() }, tx));
  const calculation = calculateForecast(facts);
  const issueCounts: Record<string, number> = {};
  for (const fact of facts) for (const key of Object.keys(fact.qualitySnapshot)) issueCounts[key] = (issueCounts[key] ?? 0) + 1;
  return {
    summary: {
      pipelineAmount: calculation.pipelineAmount.toFixed(4),
      weightedAmount: calculation.weightedAmount.toFixed(4),
      commitAmount: calculation.commitAmount.toFixed(4),
      bestCaseAmount: calculation.bestCaseAmount.toFixed(4),
      opportunityCount: calculation.items.filter((item) => item.stage !== "WON" && item.stage !== "LOST" && item.stage !== "CANCELLED" && item.category !== "OMITTED").length,
    },
    quality: { issueCounts, completeCount: facts.filter((fact) => Object.keys(fact.qualitySnapshot).length === 0).length, totalCount: facts.length },
  };
}

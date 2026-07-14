import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { calculateForecast } from "@/lib/forecast/forecast-calculator";
import { PrismaForecastRepository } from "@/lib/forecast/prisma-forecast-repository";
import { prisma } from "@/lib/prisma";

import { workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../workflow-api-response";

export async function GET(request: Request) {
  const correlationId = workflowCorrelationId(request);
  const session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  try {
    const url = new URL(request.url);
    const start = new Date(url.searchParams.get("periodStart") ?? new Date().toISOString().slice(0, 7) + "-01T00:00:00.000Z");
    const end = new Date(url.searchParams.get("periodEnd") ?? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).toISOString());
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw new SyntaxError();
    const context = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    const repository = new PrismaForecastRepository(prisma);
    const facts = await prisma.$transaction((tx) => repository.listFacts({ context, periodStart: start, periodEnd: end, cutoffAt: new Date() }, tx));
    const filters = Object.fromEntries(["ownerId", "organizationUnitId", "segment", "flow", "stage", "category"].flatMap((key) => {
      const value = url.searchParams.get(key);
      return value ? [[key, value]] : [];
    }));
    const filtered = facts.filter((fact) => Object.entries(filters).every(([key, value]) => fact[key as keyof typeof fact] === value));
    const result = calculateForecast(filtered);
    return NextResponse.json({
      data: { pipelineAmount: result.pipelineAmount.toFixed(4), weightedAmount: result.weightedAmount.toFixed(4), commitAmount: result.commitAmount.toFixed(4), bestCaseAmount: result.bestCaseAmount.toFixed(4), items: result.items.slice(0, 200).map((item) => ({ ...item, estimatedValue: item.estimatedValue.toFixed(4), forecastAmount: item.forecastAmount.toFixed(4), weightedAmount: item.weightedAmount.toFixed(4) })) },
      page: { limit: 200, hasMore: result.items.length > 200 },
      meta: { correlationId },
    });
  } catch (error) {
    return workflowApiError(error, correlationId);
  }
}

import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { buildSalesTargetScopeWhere, ForecastAccessError, loadForecastPermissions } from "@/lib/forecast/forecast-authorization";
import { createSalesTargetRuntime } from "@/lib/forecast/sales-target-runtime";
import { SalesTargetOverlapError, SalesTargetValidationError } from "@/lib/forecast/sales-target-service";
import { prisma } from "@/lib/prisma";

import { workflowCorrelationId, workflowUnauthenticated } from "../workflow-api-response";

function apiError(error: unknown, correlationId: string) {
  const validation = error instanceof SalesTargetValidationError || error instanceof ZodError || error instanceof SyntaxError;
  const status = validation ? 400 : error instanceof SalesTargetOverlapError ? 409 : error instanceof ForecastAccessError ? 404 : 500;
  const code = validation ? "VALIDATION_FAILED" : error instanceof SalesTargetOverlapError ? "TARGET_OVERLAP" : error instanceof ForecastAccessError ? "RESOURCE_NOT_FOUND" : "INTERNAL_ERROR";
  return NextResponse.json({ error: { code, message: error instanceof Error ? error.message : "Unable to process request", retryable: false, correlationId } }, { status });
}

async function actor(request: Request) {
  const correlationId = workflowCorrelationId(request);
  const session = await getSession();
  if (!session) return { response: workflowUnauthenticated(correlationId), correlationId } as const;
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const permissions = await loadForecastPermissions(authorization);
  return { actor: { id: session.id, authorization, permissions }, correlationId } as const;
}

export async function GET(request: Request) {
  const auth = await actor(request); if ("response" in auth) return auth.response;
  try {
    const url = new URL(request.url);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    if (!Number.isInteger(limit)) throw new SyntaxError();
    const fiscalYear = url.searchParams.get("fiscalYear");
    const where: Prisma.SalesTargetWhereInput = {
      AND: [buildSalesTargetScopeWhere(auth.actor.authorization), fiscalYear ? { fiscalYear: Number(fiscalYear) } : {}],
    };
    const data = await prisma.salesTarget.findMany({ where, orderBy: [{ fiscalYear: "desc" }, { fiscalMonth: "asc" }, { updatedAt: "desc" }], take: limit });
    return NextResponse.json({ data, page: { limit, hasMore: data.length === limit }, meta: { correlationId: auth.correlationId } });
  } catch (error) { return apiError(error, auth.correlationId); }
}

export async function POST(request: Request) {
  const auth = await actor(request); if ("response" in auth) return auth.response;
  try {
    const created = await createSalesTargetRuntime().create(auth.actor, await request.json(), auth.correlationId);
    return NextResponse.json({ data: created, meta: { correlationId: auth.correlationId } }, { status: 201 });
  } catch (error) { return apiError(error, auth.correlationId); }
}

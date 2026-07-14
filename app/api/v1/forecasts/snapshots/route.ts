import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { createForecastRuntime } from "@/lib/forecast/forecast-runtime";
import { listForecastSnapshots } from "@/lib/forecast/forecast-query-service";

import { workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../../workflow-api-response";

const schema = z.strictObject({ snapshotKey: z.string().trim().min(1).max(191), periodStart: z.string().datetime(), periodEnd: z.string().datetime(), cutoffAt: z.string().datetime(), formulaVersion: z.string().trim().min(1).max(64) });

export async function GET(request: Request) {
  const correlationId = workflowCorrelationId(request); const session = await getSession(); if (!session) return workflowUnauthenticated(correlationId);
  try { const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role }); const limit = Number(new URL(request.url).searchParams.get("limit") ?? 50); return NextResponse.json({ data: await listForecastSnapshots(authorization, limit), meta: { correlationId } }); }
  catch (error) { return workflowApiError(error, correlationId); }
}

export async function POST(request: Request) {
  const correlationId = workflowCorrelationId(request);
  const session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  try {
    const body = schema.parse(await request.json());
    const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    const result = await createForecastRuntime().createSnapshot({ ...session, authorization }, { snapshotKey: body.snapshotKey, periodStart: new Date(body.periodStart), periodEnd: new Date(body.periodEnd), cutoffAt: new Date(body.cutoffAt), formulaVersion: body.formulaVersion }, correlationId);
    return NextResponse.json({ data: result, meta: { correlationId } }, { status: 201 });
  } catch (error) { return workflowApiError(error, correlationId); }
}

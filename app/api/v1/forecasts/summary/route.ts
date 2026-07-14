import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { currentForecast } from "@/lib/forecast/forecast-query-service";
import { workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../../workflow-api-response";

export async function GET(request: Request) {
  const correlationId = workflowCorrelationId(request); const session = await getSession(); if (!session) return workflowUnauthenticated(correlationId);
  try { const url = new URL(request.url); const start = new Date(url.searchParams.get("periodStart") ?? new Date().toISOString().slice(0, 7) + "-01T00:00:00.000Z"); const end = new Date(url.searchParams.get("periodEnd") ?? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).toISOString()); const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role }); const result = await currentForecast(authorization, start, end); return NextResponse.json({ data: result.summary, meta: { correlationId } }); }
  catch (error) { return workflowApiError(error, correlationId); }
}

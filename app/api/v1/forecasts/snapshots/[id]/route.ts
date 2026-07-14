import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { getForecastSnapshot } from "@/lib/forecast/forecast-query-service";
import { workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../../../workflow-api-response";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = workflowCorrelationId(request); const session = await getSession(); if (!session) return workflowUnauthenticated(correlationId);
  try { const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role }); return NextResponse.json({ data: await getForecastSnapshot(authorization, (await params).id), meta: { correlationId } }); }
  catch (error) { return workflowApiError(error, correlationId); }
}

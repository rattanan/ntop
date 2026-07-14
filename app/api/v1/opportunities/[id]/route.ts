import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { getOpportunity } from "@/lib/opportunity/opportunity-query-service";
import { createOpportunityRuntime } from "@/lib/opportunity/opportunity-runtime";
import { requireIdempotencyKey, workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../../workflow-api-response";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = workflowCorrelationId(request); const session = await getSession(); if (!session) return workflowUnauthenticated(correlationId);
  try { const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role }); return NextResponse.json({ data: await getOpportunity(authorization, (await params).id), meta: { correlationId } }); }
  catch (error) { return workflowApiError(error, correlationId); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = workflowCorrelationId(request); const session = await getSession(); if (!session) return workflowUnauthenticated(correlationId);
  const key = requireIdempotencyKey(request, correlationId); if (key instanceof NextResponse) return key;
  const expectedVersion = Number(request.headers.get("if-match"));
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) return NextResponse.json({ error: { code: "IF_MATCH_REQUIRED", message: "If-Match version is required", retryable: false, correlationId } }, { status: 428 });
  try {
    const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role }); const body = await request.json();
    const input = { ...body, ownerId: body.ownerId ?? session.id, expectedCloseAt: typeof body.expectedCloseAt === "string" ? new Date(body.expectedCloseAt) : body.expectedCloseAt ?? null };
    const result = await createOpportunityRuntime().update({ ...session, authorization }, (await params).id, expectedVersion, input, correlationId, key);
    return NextResponse.json({ data: result, meta: { correlationId } });
  } catch (error) { return workflowApiError(error, correlationId); }
}

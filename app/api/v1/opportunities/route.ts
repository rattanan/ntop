import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { listOpportunities } from "@/lib/opportunity/opportunity-query-service";
import { createOpportunityRuntime } from "@/lib/opportunity/opportunity-runtime";
import { requireIdempotencyKey, workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../workflow-api-response";

function payload(body: Record<string, unknown>, actorId: string) {
  return { ...body, ownerId: body.ownerId ?? actorId, expectedCloseAt: typeof body.expectedCloseAt === "string" ? new Date(body.expectedCloseAt) : body.expectedCloseAt ?? null };
}

export async function GET(request: Request) {
  const correlationId = workflowCorrelationId(request); const session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  try {
    const url = new URL(request.url); const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    const result = await listOpportunities(authorization, { cursor: url.searchParams.get("cursor") ?? undefined, query: url.searchParams.get("q") ?? undefined, limit: url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined });
    return NextResponse.json({ data: result.items, page: { nextCursor: result.nextCursor, hasMore: result.nextCursor !== null }, meta: { correlationId } });
  } catch (error) { return workflowApiError(error, correlationId); }
}

export async function POST(request: Request) {
  const correlationId = workflowCorrelationId(request); const session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  const key = requireIdempotencyKey(request, correlationId); if (key instanceof NextResponse) return key;
  try {
    const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    const result = await createOpportunityRuntime().create({ ...session, authorization }, payload(await request.json(), session.id), correlationId, key);
    return NextResponse.json({ data: result, meta: { correlationId } }, { status: 201 });
  } catch (error) { return workflowApiError(error, correlationId); }
}

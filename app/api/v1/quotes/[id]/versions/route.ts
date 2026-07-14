import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { createQuoteRuntime } from "@/lib/commercial/quote-runtime";

import { quoteDraftSchema } from "../../route";
import { requireIdempotencyKey, workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../../../workflow-api-response";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = workflowCorrelationId(request); const session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  const key = requireIdempotencyKey(request, correlationId); if (typeof key !== "string") return key;
  try {
    const body = quoteDraftSchema.omit({ quoteId: true }).parse(await request.json());
    const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    const result = await createQuoteRuntime().createVersion({ ...session, authorization }, { ...body, quoteId: (await params).id, validUntil: body.validUntil ? new Date(body.validUntil) : null }, correlationId, key);
    return NextResponse.json({ data: result, meta: { correlationId } }, { status: 201 });
  } catch (error) { return workflowApiError(error, correlationId); }
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { createOpportunityRuntime } from "@/lib/opportunity/opportunity-runtime";
import { requireIdempotencyKey, workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../../../workflow-api-response";

const schema = z.strictObject({ probability: z.number().int().min(0).max(100), reason: z.string().trim().min(5).max(1000), expectedVersion: z.number().int().positive() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = workflowCorrelationId(request);
  const session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  const key = requireIdempotencyKey(request, correlationId);
  if (typeof key !== "string") return key;
  try {
    const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    const result = await createOpportunityRuntime().overrideProbability({ ...session, authorization }, (await params).id, schema.parse(await request.json()), correlationId, key);
    return NextResponse.json({ data: result, meta: { correlationId } });
  } catch (error) { return workflowApiError(error, correlationId); }
}

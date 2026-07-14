import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { createOpportunityRuntime } from "@/lib/opportunity/opportunity-runtime";

import { requireIdempotencyKey, workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../../../workflow-api-response";

const schema = z.strictObject({
  targetStage: z.enum(["QUALIFY", "DISCOVER", "SOLUTION", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "CANCELLED"]),
  command: z.enum(["FORWARD", "RETURN", "LOST", "REOPEN", "CANCEL", "WON"]),
  reason: z.string().trim().max(1000).optional(),
  expectedVersion: z.number().int().positive(),
  lostReason: z.string().trim().max(1000).optional(),
  lostCategory: z.string().trim().max(100).optional(),
  cancelledReason: z.string().trim().max(1000).optional(),
  expectedCloseAt: z.string().datetime().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = workflowCorrelationId(request);
  const session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  const key = requireIdempotencyKey(request, correlationId);
  if (typeof key !== "string") return key;
  try {
    const body = schema.parse(await request.json());
    const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    const result = await createOpportunityRuntime().transition(
      { ...session, authorization },
      (await params).id,
      { ...body, expectedCloseAt: body.expectedCloseAt ? new Date(body.expectedCloseAt) : undefined },
      correlationId,
      key,
    );
    return NextResponse.json({ data: result, meta: { correlationId } });
  } catch (error) {
    return workflowApiError(error, correlationId);
  }
}

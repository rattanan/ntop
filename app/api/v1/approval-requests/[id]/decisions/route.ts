import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { createApprovalRuntime } from "@/lib/commercial/approval-runtime";

import { requireIdempotencyKey, workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../../../workflow-api-response";

const schema = z.strictObject({ stepId: z.string().trim().min(1), decision: z.enum(["APPROVE", "REJECT", "RETURN", "DELEGATE", "ESCALATE"]), reason: z.string().trim().min(1).max(1000), expectedVersion: z.number().int().positive(), delegateToActorId: z.string().trim().min(1).optional() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = workflowCorrelationId(request); const session = await getSession(); if (!session) return workflowUnauthenticated(correlationId);
  const key = requireIdempotencyKey(request, correlationId); if (typeof key !== "string") return key;
  try {
    const body = schema.parse(await request.json()); const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    const result = await createApprovalRuntime().decide({ ...session, authorization }, { requestId: (await params).id, stepId: body.stepId, action: body.decision, reason: body.reason, expectedVersion: body.expectedVersion, delegateToActorId: body.delegateToActorId }, correlationId, key);
    return NextResponse.json({ data: result, meta: { correlationId } });
  } catch (error) { return workflowApiError(error, correlationId); }
}

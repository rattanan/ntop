import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { proposalTransitionSchema } from "@/lib/proposal/contracts";
import { createProposalRuntime } from "@/lib/proposal/proposal-runtime";
import { requireIdempotencyKey, workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../../../workflow-api-response";
import { proposalActor } from "../../proposal-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = workflowCorrelationId(request); const session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  const key = requireIdempotencyKey(request, correlationId); if (typeof key !== "string") return key;
  try {
    const input = proposalTransitionSchema.parse(await request.json());
    const result = await createProposalRuntime().service.transition(await proposalActor(session), (await params).id, input, correlationId, key);
    return NextResponse.json({ data: result, meta: { correlationId } });
  } catch (error) { return workflowApiError(error, correlationId); }
}

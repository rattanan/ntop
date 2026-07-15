import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { createQuoteRuntime } from "@/lib/commercial/quote-runtime";

import { requireIdempotencyKey, workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../workflow-api-response";

export const quoteDraftSchema = z.strictObject({
  quoteId: z.string().trim().min(1).optional(), proposalId: z.string().trim().min(1).optional(), opportunityId: z.string().trim().min(1), currency: z.string().trim().length(3).default("THB"),
  validUntil: z.string().datetime().nullable().optional(), notes: z.string().max(10000).optional(),
  items: z.array(z.strictObject({ productId: z.string().trim().min(1), quantity: z.string().regex(/^\d+(\.\d{1,4})?$/), unitPrice: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(), discountAmount: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(), discountPct: z.string().regex(/^\d+(\.\d{1,4})?$/).optional() })).min(1).max(100),
});

export async function POST(request: Request) {
  const correlationId = workflowCorrelationId(request); const session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  const key = requireIdempotencyKey(request, correlationId); if (typeof key !== "string") return key;
  try {
    const body = quoteDraftSchema.parse(await request.json());
    const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    const result = await createQuoteRuntime().createVersion({ ...session, authorization }, { ...body, validUntil: body.validUntil ? new Date(body.validUntil) : null }, correlationId, key);
    return NextResponse.json({ data: result, meta: { correlationId } }, { status: 201 });
  } catch (error) { return workflowApiError(error, correlationId); }
}

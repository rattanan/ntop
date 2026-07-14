import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { createQuoteRuntime } from "@/lib/commercial/quote-runtime";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";

import { requireIdempotencyKey, workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../../../workflow-api-response";

const schema = z.strictObject({ quoteVersionId: z.string().trim().min(1) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = workflowCorrelationId(request); const session = await getSession(); if (!session) return workflowUnauthenticated(correlationId);
  const key = requireIdempotencyKey(request, correlationId); if (typeof key !== "string") return key;
  try {
    const body = schema.parse(await request.json()); const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    const quote = await prisma.quote.findFirst({ where: { id: (await params).id, versions: { some: { id: body.quoteVersionId } }, opportunity: buildOpportunityScopeWhere(authorization) }, select: { id: true } });
    if (!quote) return NextResponse.json({ error: { code: "RESOURCE_NOT_FOUND", correlationId } }, { status: 404 });
    const result = await createQuoteRuntime().submit({ ...session, authorization }, body.quoteVersionId, correlationId, key);
    return NextResponse.json({ data: result, meta: { correlationId } });
  } catch (error) { return workflowApiError(error, correlationId); }
}

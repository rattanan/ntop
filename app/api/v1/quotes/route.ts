import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { createQuoteRuntime } from "@/lib/commercial/quote-runtime";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";

import { requireIdempotencyKey, workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../workflow-api-response";
import { quoteDraftSchema } from "./quote-schema";

export async function GET(request: Request) {
  const correlationId = workflowCorrelationId(request);
  const session = await getSession(request);
  if (!session) return workflowUnauthenticated(correlationId);
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim();
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));
    const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    const data = await prisma.quote.findMany({
      where: {
        opportunity: buildOpportunityScopeWhere(authorization),
        ...(query ? { OR: [{ quoteNo: { contains: query } }, { opportunity: { name: { contains: query } } }, { customer: { name: { contains: query } } }] } : {}),
      },
      select: {
        id: true, quoteNo: true, status: true, version: true, total: true, validUntil: true, updatedAt: true,
        customer: { select: { id: true, name: true } },
        opportunity: { select: { id: true, name: true } },
        versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { versionNumber: true, status: true, currency: true, total: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit,
    });
    return NextResponse.json({ data, page: { limit, hasMore: data.length === limit }, meta: { correlationId } });
  } catch (error) { return workflowApiError(error, correlationId); }
}

export async function POST(request: Request) {
  const correlationId = workflowCorrelationId(request); const session = await getSession(request);
  if (!session) return workflowUnauthenticated(correlationId);
  const key = requireIdempotencyKey(request, correlationId); if (typeof key !== "string") return key;
  try {
    const body = quoteDraftSchema.parse(await request.json());
    const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    const result = await createQuoteRuntime().createVersion({ ...session, authorization }, { ...body, validUntil: body.validUntil ? new Date(body.validUntil) : null }, correlationId, key);
    return NextResponse.json({ data: result, meta: { correlationId } }, { status: 201 });
  } catch (error) { return workflowApiError(error, correlationId); }
}

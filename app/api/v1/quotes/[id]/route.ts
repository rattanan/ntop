import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";
import { workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../../workflow-api-response";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = workflowCorrelationId(request);
  const session = await getSession(request);
  if (!session) return workflowUnauthenticated(correlationId);
  try {
    const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    const data = await prisma.quote.findFirst({
      where: { id: (await params).id, opportunity: buildOpportunityScopeWhere(authorization) },
      include: {
        customer: { select: { id: true, name: true, taxId: true } },
        opportunity: { select: { id: true, name: true, stage: true, estimatedValue: true, currency: true } },
        versions: { orderBy: { versionNumber: "desc" }, select: { id: true, versionNumber: true, status: true, currency: true, subtotal: true, discountAmount: true, total: true, validUntil: true, createdAt: true, items: { select: { id: true, productId: true, productCode: true, productName: true, quantity: true, unitPrice: true, discountAmount: true, lineTotal: true } } }, take: 20 },
      },
    });
    if (!data) return NextResponse.json({ error: { code: "RESOURCE_NOT_FOUND", message: "ไม่พบ Quotation", retryable: false, correlationId } }, { status: 404 });
    return NextResponse.json({ data, meta: { correlationId } });
  } catch (error) { return workflowApiError(error, correlationId); }
}

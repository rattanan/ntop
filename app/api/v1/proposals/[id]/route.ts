import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/authorization/permission-policy";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";
import { proposalEditSchema } from "@/lib/proposal/contracts";
import { createProposalRuntime } from "@/lib/proposal/proposal-runtime";
import { requireIdempotencyKey, workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../../workflow-api-response";
import { proposalActor } from "../proposal-api";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = workflowCorrelationId(request);
  const session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  try {
    assertPermission(session, PERMISSIONS.proposalView);
    const actor = await proposalActor(session);
    const proposal = await prisma.proposal.findFirst({
      where: { id: (await params).id, deletedAt: null, OR: [{ ownerId: session.id }, { opportunity: buildOpportunityScopeWhere(actor.authorization) }] },
      include: { customer: true, opportunity: true, owner: { select: { id: true, name: true } }, status: true, quotes: { select: { id: true, quoteNo: true, status: true } }, versions: { orderBy: { versionNumber: "desc" }, include: { createdBy: { select: { id: true, name: true } }, sections: { orderBy: { sortOrder: "asc" } } } } },
    });
    if (!proposal) return NextResponse.json({ error: { code: "RESOURCE_NOT_FOUND", correlationId } }, { status: 404 });
    return NextResponse.json({ data: proposal, meta: { correlationId } });
  } catch (error) { return workflowApiError(error, correlationId); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = workflowCorrelationId(request);
  const session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  const key = requireIdempotencyKey(request, correlationId);
  if (typeof key !== "string") return key;
  try {
    const input = proposalEditSchema.parse(await request.json());
    const result = await createProposalRuntime().service.edit(await proposalActor(session), (await params).id, input, correlationId, key);
    return NextResponse.json({ data: result, meta: { correlationId } });
  } catch (error) { return workflowApiError(error, correlationId); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = workflowCorrelationId(request);
  const session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  const key = requireIdempotencyKey(request, correlationId);
  if (typeof key !== "string") return key;
  try {
    await createProposalRuntime().service.softDelete(await proposalActor(session), (await params).id, correlationId, key);
    return new NextResponse(null, { status: 204 });
  } catch (error) { return workflowApiError(error, correlationId); }
}

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/authorization/permission-policy";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";
import { proposalCreateSchema } from "@/lib/proposal/contracts";
import { createProposalRuntime } from "@/lib/proposal/proposal-runtime";
import { requireIdempotencyKey, workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../workflow-api-response";
import { proposalActor } from "./proposal-api";

export async function GET(request: Request) {
  const correlationId = workflowCorrelationId(request);
  const session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  try {
    assertPermission(session, PERMISSIONS.proposalView);
    const actor = await proposalActor(session);
    const proposals = await prisma.proposal.findMany({
      where: { deletedAt: null, OR: [{ ownerId: session.id }, { opportunity: buildOpportunityScopeWhere(actor.authorization) }] },
      include: { customer: { select: { id: true, name: true } }, opportunity: { select: { id: true, name: true } }, owner: { select: { id: true, name: true } }, status: { select: { label: true, terminal: true } } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 200,
    });
    return NextResponse.json({ data: proposals, meta: { correlationId, count: proposals.length, limit: 200 } });
  } catch (error) { return workflowApiError(error, correlationId); }
}

export async function POST(request: Request) {
  const correlationId = workflowCorrelationId(request);
  const session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  const key = requireIdempotencyKey(request, correlationId);
  if (typeof key !== "string") return key;
  try {
    const input = proposalCreateSchema.parse(await request.json());
    const result = await createProposalRuntime().service.create(await proposalActor(session), input, correlationId, key);
    return NextResponse.json({ data: result, meta: { correlationId } }, { status: 201 });
  } catch (error) { return workflowApiError(error, correlationId); }
}

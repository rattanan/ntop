import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../../../workflow-api-response";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = workflowCorrelationId(request);
  const session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  try {
    const { id } = await params;
    const deleted = await prisma.leadSavedView.deleteMany({ where: { id, userId: session.id } });
    if (!deleted.count) return NextResponse.json({ error: { code: "RESOURCE_NOT_FOUND", message: "ไม่พบ Saved View", retryable: false, correlationId } }, { status: 404 });
    return NextResponse.json({ data: { id }, meta: { correlationId } });
  } catch (error) { return workflowApiError(error, correlationId); }
}

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/authorization/permission-policy";
import { createContractRuntime } from "@/lib/contract/contract-runtime";
import { requireIdempotencyKey, workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../../../../workflow-api-response";
import { contractActor } from "../../../contract-api";

type DocumentParams = { params: Promise<{ id: string; documentId: string }> };

function contentDisposition(fileName: string) {
  const fallback = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "document";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(request: Request, { params }: DocumentParams) {
  const correlationId = workflowCorrelationId(request), session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  try {
    assertPermission(session, PERMISSIONS.contractView);
    const { id, documentId } = await params;
    const data = await createContractRuntime().documents.download(await contractActor(session), id, documentId, correlationId);
    return new NextResponse(Buffer.from(data.bytes), { headers: { "cache-control": "private, no-store", "content-disposition": contentDisposition(data.fileName), "content-length": String(data.bytes.length), "content-type": data.mimeType } });
  } catch (error) { return workflowApiError(error, correlationId); }
}

export async function DELETE(request: Request, { params }: DocumentParams) {
  const correlationId = workflowCorrelationId(request), session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  const key = requireIdempotencyKey(request, correlationId);
  if (typeof key !== "string") return key;
  try {
    assertPermission(session, PERMISSIONS.contractManage);
    const { id, documentId } = await params;
    const data = await createContractRuntime().documents.remove(await contractActor(session), id, documentId, correlationId, key);
    return NextResponse.json({ data, meta: { correlationId } });
  } catch (error) { return workflowApiError(error, correlationId); }
}

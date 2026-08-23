import { NextResponse } from "next/server";

import { createProspectDocumentRuntime } from "@/lib/prospect/prospect-runtime";
import { prospectActor, prospectApiError, prospectIdempotencyKey } from "../../../prospect-api";

type DocumentParams = { params: Promise<{ id: string; documentId: string }> };

function contentDisposition(fileName: string) {
  const fallback = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "document";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(request: Request, { params }: DocumentParams) {
  const auth = await prospectActor(request);
  if ("response" in auth) return auth.response;
  try {
    const { id, documentId } = await params;
    const data = await createProspectDocumentRuntime().download(auth.actor, id, documentId, auth.correlationId);
    return new NextResponse(Buffer.from(data.bytes), {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": contentDisposition(data.fileName),
        "content-length": String(data.bytes.length),
        "content-type": data.mimeType,
      },
    });
  } catch (error) {
    return prospectApiError(error, auth.correlationId);
  }
}

export async function DELETE(request: Request, { params }: DocumentParams) {
  const auth = await prospectActor(request);
  if ("response" in auth) return auth.response;
  const key = prospectIdempotencyKey(request, auth.correlationId);
  if (key instanceof NextResponse) return key;
  try {
    const { id, documentId } = await params;
    const data = await createProspectDocumentRuntime().remove(auth.actor, id, documentId, auth.correlationId, key);
    return NextResponse.json({ data, meta: { correlationId: auth.correlationId } });
  } catch (error) {
    return prospectApiError(error, auth.correlationId);
  }
}

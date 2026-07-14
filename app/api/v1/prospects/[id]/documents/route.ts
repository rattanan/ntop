import { NextResponse } from "next/server";

import { MAX_PROSPECT_DOCUMENT_BYTES } from "@/lib/prospect/prospect-document-service";
import { createProspectDocumentRuntime } from "@/lib/prospect/prospect-runtime";
import { prospectActor, prospectApiError, prospectIdempotencyKey } from "../../prospect-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await prospectActor(request);
  if ("response" in auth) return auth.response;
  const key = prospectIdempotencyKey(request, auth.correlationId);
  if (key instanceof NextResponse) return key;
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new SyntaxError("file is required");
    if (file.size > MAX_PROSPECT_DOCUMENT_BYTES) throw new SyntaxError("file is too large");
    const { id } = await params;
    const data = await createProspectDocumentRuntime().upload(auth.actor, id, {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      category: String(formData.get("category") || "General"),
      bytes: new Uint8Array(await file.arrayBuffer()),
    }, auth.correlationId, key);
    return NextResponse.json({ data, meta: { correlationId: auth.correlationId } }, { status: 201 });
  } catch (error) {
    return prospectApiError(error, auth.correlationId);
  }
}

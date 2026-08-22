import { NextResponse } from "next/server";

import { createProspectRuntime } from "@/lib/prospect/prospect-runtime";
import { prospectActor, prospectApiError, prospectIdempotencyKey } from "../../../prospect-api";

type ContactParams = { params: Promise<{ id: string; contactId: string }> };

export async function PATCH(request: Request, { params }: ContactParams) {
  const auth = await prospectActor(request);
  if ("response" in auth) return auth.response;
  const key = prospectIdempotencyKey(request, auth.correlationId);
  if (key instanceof NextResponse) return key;
  try {
    const { id, contactId } = await params;
    const { expectedVersion, ...input } = await request.json();
    const data = await createProspectRuntime().updateContact(auth.actor, id, contactId, Number(expectedVersion), input, auth.correlationId, key);
    return NextResponse.json({ data, meta: { correlationId: auth.correlationId } });
  } catch (error) {
    return prospectApiError(error, auth.correlationId);
  }
}

export async function DELETE(request: Request, { params }: ContactParams) {
  const auth = await prospectActor(request);
  if ("response" in auth) return auth.response;
  const key = prospectIdempotencyKey(request, auth.correlationId);
  if (key instanceof NextResponse) return key;
  try {
    const { id, contactId } = await params;
    const body = await request.json();
    const data = await createProspectRuntime().deleteContact(auth.actor, id, contactId, Number(body.expectedVersion), auth.correlationId, key);
    return NextResponse.json({ data, meta: { correlationId: auth.correlationId } });
  } catch (error) {
    return prospectApiError(error, auth.correlationId);
  }
}

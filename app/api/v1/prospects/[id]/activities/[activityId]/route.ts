import { NextResponse } from "next/server";

import { createProspectActivityRuntime } from "@/lib/prospect/prospect-runtime";
import { prospectActor, prospectApiError, prospectIdempotencyKey } from "../../../prospect-api";

type ActivityParams = { params: Promise<{ id: string; activityId: string }> };

export async function PATCH(request: Request, { params }: ActivityParams) {
  const auth = await prospectActor(request);
  if ("response" in auth) return auth.response;
  const key = prospectIdempotencyKey(request, auth.correlationId);
  if (key instanceof NextResponse) return key;
  try {
    const { id, activityId } = await params;
    const data = await createProspectActivityRuntime().update(auth.actor, id, activityId, await request.json(), auth.correlationId, key);
    return Response.json({ data, meta: { correlationId: auth.correlationId } });
  } catch (error) {
    return prospectApiError(error, auth.correlationId);
  }
}

export async function DELETE(request: Request, { params }: ActivityParams) {
  const auth = await prospectActor(request);
  if ("response" in auth) return auth.response;
  const key = prospectIdempotencyKey(request, auth.correlationId);
  if (key instanceof NextResponse) return key;
  try {
    const { id, activityId } = await params;
    const data = await createProspectActivityRuntime().remove(auth.actor, id, activityId, await request.json(), auth.correlationId, key);
    return Response.json({ data, meta: { correlationId: auth.correlationId } });
  } catch (error) {
    return prospectApiError(error, auth.correlationId);
  }
}

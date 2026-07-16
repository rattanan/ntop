import { NextResponse } from "next/server";
import { createActivityRuntime } from "@/lib/activity/activity-runtime";
import { activityActor, activityApiError } from "../../activity-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await activityActor(request);
  if ("response" in auth) return auth.response;
  try {
    const data = await createActivityRuntime().transition(auth.actor, (await params).id, await request.json(), auth.correlationId);
    return NextResponse.json({ data, meta: { correlationId: auth.correlationId } });
  } catch (error) {
    return activityApiError(error, auth.correlationId);
  }
}

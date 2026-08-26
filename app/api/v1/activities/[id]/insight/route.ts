import { NextResponse } from "next/server";

import { createActivityRuntime } from "@/lib/activity/activity-runtime";
import { activityActor, activityApiError } from "../../activity-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await activityActor(request);
  if ("response" in auth) return auth.response;
  try {
    const data = await createActivityRuntime().draftMeetingInsight(auth.actor, (await params).id);
    return NextResponse.json({ data, meta: { correlationId: auth.correlationId } });
  } catch (error) {
    return activityApiError(error, auth.correlationId);
  }
}

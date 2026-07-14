import { NextResponse } from "next/server";

import { activityActor, activityApiError } from "../activity-api";
import { buildActivityScopeWhere } from "@/lib/activity/activity-authorization";
import { createActivityRuntime } from "@/lib/activity/activity-runtime";
import { ActivityAccessError } from "@/lib/activity/activity-service";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await activityActor(request); if ("response" in auth) return auth.response;
  const { id } = await params;
  const data = await prisma.activity.findFirst({ where: { id, deletedAt: null, ...buildActivityScopeWhere(auth.actor.authorization) }, include: { owner: { select: { id: true, name: true } }, customer: { select: { id: true, name: true } }, opportunity: { select: { id: true, name: true } }, lead: { select: { id: true, leadNumber: true, company: true } }, prospect: { select: { id: true, prospectCode: true, companyName: true } } } });
  if (!data) return activityApiError(new ActivityAccessError(), auth.correlationId);
  return NextResponse.json({ data, meta: { correlationId: auth.correlationId } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await activityActor(request); if ("response" in auth) return auth.response;
  try { const { id } = await params; const data = await createActivityRuntime().update(auth.actor, id, await request.json(), auth.correlationId); return NextResponse.json({ data, meta: { correlationId: auth.correlationId } }); }
  catch (error) { return activityApiError(error, auth.correlationId); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await activityActor(request); if ("response" in auth) return auth.response;
  try { const { id } = await params; const data = await createActivityRuntime().remove(auth.actor, id, await request.json(), auth.correlationId); return NextResponse.json({ data, meta: { correlationId: auth.correlationId } }); }
  catch (error) { return activityApiError(error, auth.correlationId); }
}

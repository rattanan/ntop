import { NextResponse } from "next/server";

import { activityActor, activityApiError } from "./activity-api";
import { buildActivityScopeWhere } from "@/lib/activity/activity-authorization";
import { createActivityRuntime } from "@/lib/activity/activity-runtime";
import { prisma } from "@/lib/prisma";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: Request) {
  const auth = await activityActor(request);
  if ("response" in auth) return auth.response;
  try {
    const url = new URL(request.url);
    const requestedLimit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : DEFAULT_LIMIT;
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > MAX_LIMIT) {
      return activityApiError(new SyntaxError("Invalid limit"), auth.correlationId);
    }
    const cursor = url.searchParams.get("cursor")?.trim() || undefined;
    const rows = await prisma.activity.findMany({
      where: { deletedAt: null, ...buildActivityScopeWhere(auth.actor.authorization) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: requestedLimit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        status: { select: { code: true, label: true, terminal: true } },
        owner: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        opportunity: { select: { id: true, name: true } },
      },
    });
    const hasMore = rows.length > requestedLimit;
    const data = hasMore ? rows.slice(0, requestedLimit) : rows;
    return NextResponse.json({
      data,
      page: { limit: requestedLimit, nextCursor: hasMore ? data.at(-1)?.id ?? null : null, hasMore },
      meta: { correlationId: auth.correlationId },
    });
  } catch (error) {
    return activityApiError(error, auth.correlationId);
  }
}

export async function POST(request: Request) {
  const auth = await activityActor(request);
  if ("response" in auth) return auth.response;
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 191) {
    return NextResponse.json({ error: { code: "IDEMPOTENCY_KEY_REQUIRED", message: "Idempotency-Key is required", retryable: false, correlationId: auth.correlationId } }, { status: 400 });
  }
  try {
    const data = await createActivityRuntime().create(auth.actor, await request.json(), auth.correlationId, idempotencyKey);
    return NextResponse.json({ data, meta: { correlationId: auth.correlationId } }, { status: 201 });
  } catch (error) {
    return activityApiError(error, auth.correlationId);
  }
}

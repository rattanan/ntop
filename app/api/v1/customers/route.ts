import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { listCustomers } from "@/lib/customer/customer-query-service";
import { createCustomerRuntime } from "@/lib/customer/customer-runtime";

import {
  apiError,
  correlationId,
  unauthenticated,
} from "./api-response";

function normalizeCreatePayload(value: unknown, actorId: string) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const body = value as Record<string, unknown>;
  return {
    name: body.name ?? body.legalName,
    taxId: body.taxId,
    type: body.type ?? body.customerType,
    segment: body.segment,
    province: body.province,
    address: body.address,
    status: body.status ?? "PROSPECT",
    ownerId: body.ownerId ?? actorId,
    organizationUnitId: body.organizationUnitId ?? null,
    externalIds: body.externalIds ?? [],
    contact: body.contact,
  };
}

export async function GET(request: Request) {
  const requestCorrelationId = correlationId(request);
  const session = await getSession();
  if (!session) return unauthenticated(requestCorrelationId);
  try {
    const url = new URL(request.url);
    const context = await loadAuthorizationContext({
      actorId: session.id,
      legacyRole: session.role,
    });
    const result = await listCustomers(context, {
      query: url.searchParams.get("q") ?? undefined,
      segment: url.searchParams.get("segment") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      pageSize: url.searchParams.has("limit")
        ? Number(url.searchParams.get("limit"))
        : undefined,
    });
    return NextResponse.json({
      data: result.items,
      page: {
        nextCursor: result.nextCursor,
        hasMore: result.nextCursor !== null,
      },
      meta: { correlationId: requestCorrelationId },
    });
  } catch (error) {
    return apiError(error, requestCorrelationId);
  }
}

export async function POST(request: Request) {
  const requestCorrelationId = correlationId(request);
  const session = await getSession();
  if (!session) return unauthenticated(requestCorrelationId);
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 191) {
    return NextResponse.json(
      {
        error: {
          code: "IDEMPOTENCY_KEY_REQUIRED",
          message: "Idempotency-Key is required",
          retryable: false,
          correlationId: requestCorrelationId,
        },
      },
      { status: 400 },
    );
  }
  try {
    const authorization = await loadAuthorizationContext({
      actorId: session.id,
      legacyRole: session.role,
    });
    const created = await createCustomerRuntime().create(
      { ...session, authorization },
      normalizeCreatePayload(await request.json(), session.id),
      requestCorrelationId,
      idempotencyKey,
    );
    return NextResponse.json(
      {
        data: created,
        meta: { correlationId: requestCorrelationId },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error, requestCorrelationId);
  }
}

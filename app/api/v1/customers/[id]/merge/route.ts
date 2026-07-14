import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { createCustomerRuntime } from "@/lib/customer/customer-runtime";

import {
  apiError,
  correlationId,
  unauthenticated,
} from "../../api-response";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const authorization = await loadAuthorizationContext({
      actorId: session.id,
      legacyRole: session.role,
    });
    const merged = await createCustomerRuntime().merge(
      { ...session, authorization },
      {
        sourceCustomerId: String(body.sourceCustomerId ?? ""),
        targetCustomerId: id,
        reason: String(body.reason ?? ""),
      },
      requestCorrelationId,
      idempotencyKey,
    );
    return NextResponse.json({
      data: merged,
      meta: { correlationId: requestCorrelationId },
    });
  } catch (error) {
    return apiError(error, requestCorrelationId);
  }
}

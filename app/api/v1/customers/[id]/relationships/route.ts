import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { CustomerRelationshipError } from "@/lib/customer/customer-service";
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
    const effectiveFrom = new Date(String(body.effectiveFrom));
    const effectiveTo = body.effectiveTo
      ? new Date(String(body.effectiveTo))
      : null;
    if (
      Number.isNaN(effectiveFrom.getTime()) ||
      (effectiveTo && Number.isNaN(effectiveTo.getTime()))
    ) {
      throw new CustomerRelationshipError();
    }
    const authorization = await loadAuthorizationContext({
      actorId: session.id,
      legacyRole: session.role,
    });
    const relationship = await createCustomerRuntime().addRelationship(
      { ...session, authorization },
      {
        parentCustomerId: id,
        childCustomerId: String(body.childCustomerId ?? ""),
        relationshipType: String(body.relationshipType ?? ""),
        effectiveFrom,
        effectiveTo,
      },
      requestCorrelationId,
      idempotencyKey,
    );
    return NextResponse.json(
      {
        data: relationship,
        meta: { correlationId: requestCorrelationId },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error, requestCorrelationId);
  }
}

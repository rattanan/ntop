import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { createCustomerRuntime } from "@/lib/customer/customer-runtime";
import { getCustomer360 } from "@/lib/customer/prisma-customer-repository";
import { prisma } from "@/lib/prisma";

import {
  apiError,
  correlationId,
  unauthenticated,
} from "../api-response";

function normalizeUpdatePayload(value: unknown) {
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
    status: body.status,
    ownerId: body.ownerId,
    organizationUnitId: body.organizationUnitId ?? null,
    externalIds: body.externalIds ?? [],
    contact: body.contact,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestCorrelationId = correlationId(request);
  const session = await getSession();
  if (!session) return unauthenticated(requestCorrelationId);
  try {
    const { id } = await params;
    const authorization = await loadAuthorizationContext({
      actorId: session.id,
      legacyRole: session.role,
    });
    const customer = await getCustomer360(prisma, authorization, id);
    if (!customer) {
      return NextResponse.json(
        {
          error: {
            code: "CUSTOMER_NOT_FOUND",
            message: "Customer not found",
            retryable: false,
            correlationId: requestCorrelationId,
          },
        },
        { status: 404 },
      );
    }
    return NextResponse.json({
      data: customer,
      meta: { correlationId: requestCorrelationId },
    });
  } catch (error) {
    return apiError(error, requestCorrelationId);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestCorrelationId = correlationId(request);
  const session = await getSession();
  if (!session) return unauthenticated(requestCorrelationId);
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  const ifMatch = request.headers.get("if-match")?.replaceAll('"', "").trim();
  const expectedVersion = Number(ifMatch);
  if (
    !idempotencyKey ||
    idempotencyKey.length > 191 ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 1
  ) {
    return NextResponse.json(
      {
        error: {
          code: "PRECONDITION_REQUIRED",
          message: "Idempotency-Key and numeric If-Match are required",
          retryable: false,
          correlationId: requestCorrelationId,
        },
      },
      { status: 428 },
    );
  }
  try {
    const { id } = await params;
    const authorization = await loadAuthorizationContext({
      actorId: session.id,
      legacyRole: session.role,
    });
    const updated = await createCustomerRuntime().update(
      { ...session, authorization },
      id,
      expectedVersion,
      normalizeUpdatePayload(await request.json()),
      requestCorrelationId,
      idempotencyKey,
    );
    return NextResponse.json({
      data: updated,
      meta: { correlationId: requestCorrelationId },
    });
  } catch (error) {
    return apiError(error, requestCorrelationId);
  }
}

export { PATCH as PUT };

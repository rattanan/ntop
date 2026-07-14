import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  PermissionDeniedError,
} from "@/lib/authorization/permission-policy";
import {
  CustomerAccessError,
  CustomerIdentityConflictError,
  CustomerIdempotencyConflictError,
  CustomerMergeError,
  CustomerRelationshipError,
  CustomerValidationError,
  CustomerVersionConflictError,
} from "@/lib/customer/customer-service";
import { CustomerQueryValidationError } from "@/lib/customer/customer-query-service";

export function correlationId(request: Request) {
  const supplied = request.headers.get("x-correlation-id")?.trim();
  return supplied && supplied.length <= 191 ? supplied : crypto.randomUUID();
}

export function apiError(error: unknown, requestCorrelationId: string) {
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "ไม่สามารถดำเนินการได้";
  let fieldErrors: Array<{ field: string; code: string }> | undefined;
  if (
    error instanceof CustomerValidationError ||
    error instanceof CustomerQueryValidationError ||
    error instanceof SyntaxError
  ) {
    status = 400;
    code = "CUSTOMER_VALIDATION_FAILED";
    message = "ข้อมูลลูกค้าไม่ถูกต้อง";
    if (error instanceof CustomerValidationError) {
      fieldErrors = Object.entries(error.issues ?? {}).flatMap(
        ([field, values]) =>
          values.map((value) => ({ field, code: value })),
      );
    }
  } else if (error instanceof PermissionDeniedError) {
    status = 403;
    code = "FORBIDDEN";
  } else if (error instanceof CustomerAccessError) {
    status = 404;
    code = "CUSTOMER_NOT_FOUND";
  } else if (error instanceof CustomerVersionConflictError) {
    status = 409;
    code = "VERSION_CONFLICT";
  } else if (error instanceof CustomerIdentityConflictError) {
    status = 409;
    code = "CUSTOMER_IDENTITY_CONFLICT";
  } else if (error instanceof CustomerIdempotencyConflictError) {
    status = 409;
    code = "IDEMPOTENCY_CONFLICT";
  } else if (
    error instanceof CustomerRelationshipError ||
    error instanceof CustomerMergeError
  ) {
    status = 422;
    code = "CUSTOMER_RULE_DENIED";
  } else if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    status = 409;
    code = "CUSTOMER_CONFLICT";
  }
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(fieldErrors ? { fieldErrors } : {}),
        retryable: false,
        correlationId: requestCorrelationId,
      },
    },
    { status },
  );
}

export function unauthenticated(requestCorrelationId: string) {
  return NextResponse.json(
    {
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required",
        retryable: false,
        correlationId: requestCorrelationId,
      },
    },
    { status: 401 },
  );
}

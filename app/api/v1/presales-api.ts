import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { safeErrorIdentity } from "@/lib/api/safe-error-identity";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import {
  PresalesAccessError,
  PresalesImmutableError,
  PresalesPermissionError,
  PresalesTransitionError,
  PresalesValidationError,
} from "@/lib/solution-design/solution-design-service";

import { workflowCorrelationId, workflowUnauthenticated } from "./workflow-api-response";
import { ApprovalWorkflowDisabledError } from "@/lib/approval/approval-control";

export async function presalesActor(request: Request) {
  const correlationId = workflowCorrelationId(request);
  const session = await getSession();
  if (!session) return { response: workflowUnauthenticated(correlationId) } as const;
  const authorization = await loadAuthorizationContext({
    actorId: session.id,
    legacyRole: session.role,
  });
  return { actor: { ...session, authorization }, correlationId } as const;
}

export function presalesApiError(error: unknown, correlationId: string) {
  let status = 500;
  let code = "INTERNAL_ERROR";
  let fieldErrors: undefined | Array<{ field: string; code: string }>;
  if (error instanceof ApprovalWorkflowDisabledError) {
    status = 409;
    code = "APPROVAL_WORKFLOW_DISABLED";
  } else if (error instanceof PresalesValidationError) {
    status = 400;
    code = "VALIDATION_FAILED";
    fieldErrors = error.fields.map(field => ({ field, code: "INVALID" }));
  } else if (error instanceof PresalesPermissionError) {
    status = 403;
    code = "FORBIDDEN";
  } else if (error instanceof PresalesAccessError) {
    status = 404;
    code = "RESOURCE_NOT_FOUND";
  } else if (error instanceof PresalesTransitionError) {
    status = 422;
    code = "TRANSITION_DENIED";
    fieldErrors = error.fields.map(field => ({ field, code: "REQUIRED" }));
  } else if (error instanceof PresalesImmutableError) {
    status = 409;
    code = "HISTORICAL_VERSION_IMMUTABLE";
  }
  if (status === 500) {
    console.error("presales_api_internal_error", {
      correlationId,
      error: safeErrorIdentity(error),
    });
  }
  return NextResponse.json({
    error: {
      code,
      message: "ไม่สามารถดำเนินการได้",
      ...(fieldErrors ? { fieldErrors } : {}),
      retryable: false,
      correlationId,
    },
  }, { status });
}

export async function jsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new PresalesValidationError(["body"]);
  }
}

export function presalesIdempotencyKey(request: Request, correlationId: string) {
  const key = request.headers.get("idempotency-key")?.trim();
  if (key && key.length <= 191) return key;
  return NextResponse.json({
    error: { code: "IDEMPOTENCY_KEY_REQUIRED", message: "Idempotency-Key is required", retryable: false, correlationId },
  }, { status: 400 });
}

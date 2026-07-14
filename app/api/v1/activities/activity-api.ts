import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PermissionDeniedError } from "@/lib/authorization/permission-policy";
import { ActivityAccessError, ActivityConflictError, ActivityValidationError } from "@/lib/activity/activity-service";
import { workflowCorrelationId, workflowUnauthenticated } from "../workflow-api-response";

export async function activityActor(request: Request) {
  const correlationId = workflowCorrelationId(request); const session = await getSession();
  if (!session) return { response: workflowUnauthenticated(correlationId), correlationId } as const;
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  return { actor: { id: session.id, role: session.role, authorization }, correlationId } as const;
}

export function activityApiError(error: unknown, correlationId: string) {
  let status = 500, code = "INTERNAL_ERROR", message = "ไม่สามารถดำเนินการได้", data: unknown;
  if (error instanceof ActivityValidationError || error instanceof SyntaxError) { status = 400; code = "VALIDATION_FAILED"; message = error.message; data = error instanceof ActivityValidationError ? error.issues : undefined; }
  else if (error instanceof ActivityAccessError) { status = 404; code = "RESOURCE_NOT_FOUND"; message = error.message; }
  else if (error instanceof ActivityConflictError) { status = 409; code = "VERSION_CONFLICT"; message = error.message; }
  else if (error instanceof PermissionDeniedError) { status = 403; code = "PERMISSION_DENIED"; message = "บัญชีนี้ไม่มีสิทธิ์แก้ไข Activity"; }
  return NextResponse.json({ error: { code, message, ...(data ? { data } : {}), retryable: status === 409, correlationId } }, { status });
}

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PermissionDeniedError } from "@/lib/authorization/permission-policy";
import { CatalogAccessError, CatalogIdempotencyConflictError, CatalogValidationError, CatalogVersionConflictError, ProductCodeConflictError } from "@/lib/presales/catalog-service";
import { workflowCorrelationId, workflowUnauthenticated } from "./workflow-api-response";

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

export async function catalogActor(request: Request) {
  const correlationId = workflowCorrelationId(request);
  const session = await getSession();
  if (!session) return { response: workflowUnauthenticated(correlationId), correlationId } as const;
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  return { actor: { id: session.id, role: session.role, authorization }, correlationId } as const;
}
export function catalogLimit(url: URL) {
  const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new CatalogValidationError({ limit: [`limit ต้องอยู่ระหว่าง 1-${MAX_LIMIT}`] });
  return limit;
}
export function catalogIdempotencyKey(request: Request, correlationId: string) {
  const key = request.headers.get("idempotency-key")?.trim();
  if (key && key.length <= 191) return key;
  return NextResponse.json({ error: { code: "IDEMPOTENCY_KEY_REQUIRED", message: "Idempotency-Key is required", retryable: false, correlationId } }, { status: 400 });
}
export function catalogApiError(error: unknown, correlationId: string) {
  let status = 500, code = "INTERNAL_ERROR", message = "ไม่สามารถดำเนินการได้", fieldErrors: Array<{ field: string; code: string }> | undefined;
  if (error instanceof CatalogValidationError || error instanceof SyntaxError) { status = 400; code = "VALIDATION_FAILED"; message = error.message; if (error instanceof CatalogValidationError) fieldErrors = Object.entries(error.issues).flatMap(([field, values]) => values.map((value) => ({ field, code: value }))); }
  else if (error instanceof PermissionDeniedError) { status = 403; code = "FORBIDDEN"; message = "ไม่มีสิทธิ์ดำเนินการ"; }
  else if (error instanceof CatalogAccessError) { status = 404; code = "RESOURCE_NOT_FOUND"; message = error.message; }
  else if (error instanceof CatalogVersionConflictError) { status = 409; code = "VERSION_CONFLICT"; message = error.message; }
  else if (error instanceof CatalogIdempotencyConflictError) { status = 409; code = "IDEMPOTENCY_CONFLICT"; message = error.message; }
  else if (error instanceof ProductCodeConflictError) { status = 409; code = "PRODUCT_CODE_CONFLICT"; message = error.message; fieldErrors = [{ field: "code", code: "DUPLICATE" }]; }
  return NextResponse.json({ error: { code, message, ...(fieldErrors ? { fieldErrors } : {}), retryable: false, correlationId } }, { status });
}

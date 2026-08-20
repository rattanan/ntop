import { CoverageStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { catalogActor, catalogApiError, catalogIdempotencyKey, catalogLimit } from "../catalog-api";
import { createCatalogRuntime } from "@/lib/presales/catalog-runtime";

export async function GET(request: Request) {
  const auth = await catalogActor(request); if ("response" in auth) return auth.response;
  try {
    const url = new URL(request.url), statusValue = url.searchParams.get("status");
    if (statusValue && !Object.values(CoverageStatus).includes(statusValue as CoverageStatus)) throw new SyntaxError("Invalid status filter");
    const limit = catalogLimit(url); const result = await createCatalogRuntime().listCoverage(auth.actor, { limit, cursor: url.searchParams.get("cursor") || undefined, ...(statusValue ? { status: statusValue as CoverageStatus } : {}) });
    return NextResponse.json({ data: result.items, page: { limit, nextCursor: result.nextCursor, hasMore: result.nextCursor !== null }, meta: { correlationId: auth.correlationId } });
  } catch (error) { return catalogApiError(error, auth.correlationId); }
}
export async function POST(request: Request) {
  const auth = await catalogActor(request); if ("response" in auth) return auth.response;
  const key = catalogIdempotencyKey(request, auth.correlationId); if (key instanceof NextResponse) return key;
  try { const data = await createCatalogRuntime().createCoverage(auth.actor, await request.json(), auth.correlationId, key); return NextResponse.json({ data, meta: { correlationId: auth.correlationId } }, { status: 201, headers: { Location: `/api/v1/coverage-checks/${data.id}` } }); }
  catch (error) { return catalogApiError(error, auth.correlationId); }
}

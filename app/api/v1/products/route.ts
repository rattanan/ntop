import { NextResponse } from "next/server";

import { catalogActor, catalogApiError, catalogIdempotencyKey, catalogLimit } from "../catalog-api";
import { createCatalogRuntime } from "@/lib/presales/catalog-runtime";

export async function GET(request: Request) {
  const auth = await catalogActor(request); if ("response" in auth) return auth.response;
  try {
    const url = new URL(request.url); const activeValue = url.searchParams.get("active");
    if (activeValue !== null && activeValue !== "true" && activeValue !== "false") throw new SyntaxError("Invalid active filter");
    const result = await createCatalogRuntime().listProducts(auth.actor, { limit: catalogLimit(url), cursor: url.searchParams.get("cursor") || undefined, query: url.searchParams.get("q") || undefined, ...(activeValue === null ? {} : { active: activeValue === "true" }) });
    return NextResponse.json({ data: result.items, page: { limit: catalogLimit(url), nextCursor: result.nextCursor, hasMore: result.nextCursor !== null }, meta: { correlationId: auth.correlationId } });
  } catch (error) { return catalogApiError(error, auth.correlationId); }
}
export async function POST(request: Request) {
  const auth = await catalogActor(request); if ("response" in auth) return auth.response;
  const key = catalogIdempotencyKey(request, auth.correlationId); if (key instanceof NextResponse) return key;
  try { const data = await createCatalogRuntime().createProduct(auth.actor, await request.json(), auth.correlationId, key); return NextResponse.json({ data, meta: { correlationId: auth.correlationId } }, { status: 201, headers: { Location: `/api/v1/products/${data.id}` } }); }
  catch (error) { return catalogApiError(error, auth.correlationId); }
}

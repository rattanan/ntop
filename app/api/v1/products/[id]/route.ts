import { NextResponse } from "next/server";

import { catalogActor, catalogApiError } from "../../catalog-api";
import { createCatalogRuntime } from "@/lib/presales/catalog-runtime";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) { const auth = await catalogActor(request); if ("response" in auth) return auth.response; try { const data = await createCatalogRuntime().getProduct(auth.actor, (await params).id); return NextResponse.json({ data, meta: { correlationId: auth.correlationId } }); } catch (error) { return catalogApiError(error, auth.correlationId); } }
export async function PATCH(request: Request, { params }: Context) { const auth = await catalogActor(request); if ("response" in auth) return auth.response; try { const data = await createCatalogRuntime().updateProduct(auth.actor, (await params).id, await request.json(), auth.correlationId); return NextResponse.json({ data, meta: { correlationId: auth.correlationId } }); } catch (error) { return catalogApiError(error, auth.correlationId); } }
export async function DELETE(request: Request, { params }: Context) { const auth = await catalogActor(request); if ("response" in auth) return auth.response; try { const data = await createCatalogRuntime().removeProduct(auth.actor, (await params).id, await request.json(), auth.correlationId); return NextResponse.json({ data, meta: { correlationId: auth.correlationId } }); } catch (error) { return catalogApiError(error, auth.correlationId); } }

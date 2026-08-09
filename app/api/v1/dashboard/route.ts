import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext, loadGrantedPermissions } from "@/lib/authorization/authorization-context";
import { DashboardAccessError, loadDashboardData } from "@/lib/dashboard/dashboard-query";
import { DashboardFilterError, parseDashboardFilters } from "@/lib/dashboard/dashboard-filters";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required.", correlationId } },
      { status: 401 },
    );
  }
  try {
    const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    const grantedPermissions = await loadGrantedPermissions(authorization);
    const filters = parseDashboardFilters(new URL(request.url).searchParams);
    const data = await loadDashboardData({ id: session.id, authorization, grantedPermissions }, filters);
    return NextResponse.json(
      { data, meta: { correlationId } },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=30", "x-correlation-id": correlationId } },
    );
  } catch (error) {
    const status = error instanceof DashboardAccessError ? 403 : error instanceof DashboardFilterError ? 400 : 500;
    const code = status === 403 ? "FORBIDDEN" : status === 400 ? "INVALID_FILTER" : "DASHBOARD_FAILED";
    return NextResponse.json(
      { error: { code, message: status === 500 ? "Dashboard could not be loaded." : error instanceof Error ? error.message : "Request failed.", correlationId } },
      { status, headers: { "Cache-Control": "no-store", "x-correlation-id": correlationId } },
    );
  }
}

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { createDataRetentionRuntime } from "@/lib/data-retention/data-retention-runtime";
import { prospectApiError, workflowCorrelationId } from "@/app/api/v1/prospects/prospect-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = workflowCorrelationId(request); const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "UNAUTHENTICATED", correlationId } }, { status: 401 });
  try {
    const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    const data = await createDataRetentionRuntime().restoreProspect({ id: session.id, authorization }, (await params).id, await request.json(), correlationId);
    return NextResponse.json({ data, meta: { correlationId } });
  } catch (error) { return prospectApiError(error, correlationId); }
}

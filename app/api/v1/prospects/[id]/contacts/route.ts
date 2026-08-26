import { NextResponse } from "next/server";

import { createProspectRuntime } from "@/lib/prospect/prospect-runtime";
import { prisma } from "@/lib/prisma";
import { prospectActor, prospectApiError, prospectIdempotencyKey } from "../../prospect-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await prospectActor(request);
  if ("response" in auth) return auth.response;
  const key = prospectIdempotencyKey(request, auth.correlationId);
  if (key instanceof NextResponse) return key;
  try {
    const { id } = await params;
    const { expectedVersion, ...input } = await request.json();
    const contact = await createProspectRuntime().addContact(auth.actor, id, input, auth.correlationId, key, expectedVersion === undefined ? undefined : Number(expectedVersion));
    const parent = await prisma.prospect.findUniqueOrThrow({ where: { id }, select: { version: true } });
    return NextResponse.json({ data: { ...contact, version: parent.version }, meta: { correlationId: auth.correlationId } }, { status: 201 });
  } catch (error) {
    return prospectApiError(error, auth.correlationId);
  }
}

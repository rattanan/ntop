import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../../workflow-api-response";

const QUERY_KEYS = ["q", "status", "temperature", "owner", "overdue", "archived", "sort", "direction"] as const;
const COLUMN_KEYS = ["lead", "source", "status", "score", "followUp", "owner", "actions"] as const;
const schema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  query: z.record(z.string(), z.string().max(500)).default({}),
  columns: z.array(z.enum(COLUMN_KEYS)).max(COLUMN_KEYS.length).optional(),
  isDefault: z.boolean().optional().default(false),
});

export async function GET(request: Request) {
  const correlationId = workflowCorrelationId(request);
  const session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  try {
    const data = await prisma.leadSavedView.findMany({ where: { userId: session.id }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
    return NextResponse.json({ data, meta: { correlationId } });
  } catch (error) { return workflowApiError(error, correlationId); }
}

export async function POST(request: Request) {
  const correlationId = workflowCorrelationId(request);
  const session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  try {
    const parsed = schema.parse(await request.json());
    const query = Object.fromEntries(Object.entries(parsed.query).filter(([key, value]) => (QUERY_KEYS as readonly string[]).includes(key) && value.length > 0));
    const data = await prisma.$transaction(async transaction => {
      if (parsed.isDefault) await transaction.leadSavedView.updateMany({ where: { userId: session.id, isDefault: true }, data: { isDefault: false } });
      return transaction.leadSavedView.upsert({
        where: { userId_name: { userId: session.id, name: parsed.name } },
        create: { userId: session.id, name: parsed.name, query: query as Prisma.InputJsonValue, columns: (parsed.columns ?? COLUMN_KEYS) as unknown as Prisma.InputJsonValue, isDefault: parsed.isDefault },
        update: { query: query as Prisma.InputJsonValue, columns: (parsed.columns ?? COLUMN_KEYS) as unknown as Prisma.InputJsonValue, isDefault: parsed.isDefault },
      });
    });
    return NextResponse.json({ data, meta: { correlationId } }, { status: 201 });
  } catch (error) { return workflowApiError(error, correlationId); }
}

import { LeadAssignmentStrategy, LeadSource, type Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { createLeadAuditWriter } from "@/lib/lead/lead-runtime";
import { LEAD_ASSIGNMENT_RULE_ADMIN_ROLES } from "@/lib/lead/lead-rules";
import { prisma } from "@/lib/prisma";
import { workflowApiError, workflowCorrelationId, workflowUnauthenticated } from "../../workflow-api-response";

const criteriaSchema = z.strictObject({ source: z.enum(LeadSource).optional(), companyContains: z.string().trim().max(255).optional(), productContains: z.string().trim().max(255).optional() });
const ruleSchema = z.strictObject({ id: z.string().trim().min(1).optional(), name: z.string().trim().min(2).max(191), priority: z.number().int().min(0).max(10000), active: z.boolean(), strategy: z.enum(LeadAssignmentStrategy), criteria: criteriaSchema, targetOwnerId: z.string().trim().min(1).nullable().optional(), organizationUnitId: z.string().trim().min(1).nullable().optional() });

async function requireRuleAdmin(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  const context = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  return context.assignments.some(item => (LEAD_ASSIGNMENT_RULE_ADMIN_ROLES as readonly string[]).includes(item.role));
}

export async function GET(request: Request) {
  const correlationId = workflowCorrelationId(request), session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  if (!await requireRuleAdmin(session)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "ไม่มีสิทธิ์จัดการ Assignment Rule", retryable: false, correlationId } }, { status: 403 });
  try {
    const data = await prisma.leadAssignmentRule.findMany({ include: { targetOwner: { select: { id: true, name: true } }, organizationUnit: { select: { id: true, name: true } } }, orderBy: [{ priority: "asc" }, { id: "asc" }] });
    return NextResponse.json({ data, meta: { correlationId } });
  } catch (error) { return workflowApiError(error, correlationId); }
}

export async function POST(request: Request) {
  const correlationId = workflowCorrelationId(request), session = await getSession();
  if (!session) return workflowUnauthenticated(correlationId);
  if (!await requireRuleAdmin(session)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "ไม่มีสิทธิ์จัดการ Assignment Rule", retryable: false, correlationId } }, { status: 403 });
  try {
    const input = ruleSchema.parse(await request.json());
    if (input.strategy === "OWNER" && !input.targetOwnerId) return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "OWNER strategy ต้องระบุผู้รับผิดชอบ", retryable: false, correlationId } }, { status: 400 });
    if (input.strategy === "ROUND_ROBIN" && !input.organizationUnitId) return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "ROUND_ROBIN ต้องระบุหน่วยงาน", retryable: false, correlationId } }, { status: 400 });
    const data = await prisma.$transaction(async transaction => {
      if (input.targetOwnerId && !await transaction.user.count({ where: { id: input.targetOwnerId, active: true } })) throw new Error("TARGET_OWNER_UNAVAILABLE");
      if (input.organizationUnitId && !await transaction.organizationUnit.count({ where: { id: input.organizationUnitId, active: true } })) throw new Error("ORGANIZATION_UNIT_UNAVAILABLE");
      const values = { name: input.name, priority: input.priority, active: input.active, strategy: input.strategy, criteria: input.criteria as Prisma.InputJsonValue, targetOwnerId: input.strategy === "OWNER" ? input.targetOwnerId : null, organizationUnitId: input.organizationUnitId ?? null };
      const rule = input.id ? await transaction.leadAssignmentRule.update({ where: { id: input.id }, data: values }) : await transaction.leadAssignmentRule.create({ data: values });
      await createLeadAuditWriter().append({ actorId: session.id, action: input.id ? "lead.assignment-rule.update" : "lead.assignment-rule.create", targetType: "LeadAssignmentRule", targetId: rule.id, outcome: "SUCCESS", correlationId, data: { name: rule.name, priority: rule.priority, active: rule.active, strategy: rule.strategy } }, { transaction });
      return rule;
    });
    return NextResponse.json({ data, meta: { correlationId } }, { status: input.id ? 200 : 201 });
  } catch (error) {
    if (error instanceof Error && ["TARGET_OWNER_UNAVAILABLE", "ORGANIZATION_UNIT_UNAVAILABLE"].includes(error.message)) return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "ผู้รับผิดชอบหรือหน่วยงานไม่พร้อมใช้งาน", retryable: false, correlationId } }, { status: 400 });
    return workflowApiError(error, correlationId);
  }
}

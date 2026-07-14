"use server";

import { ActivityType, LeadStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { FormState } from "@/app/action-types";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PermissionDeniedError } from "@/lib/authorization/permission-policy";
import {
  LeadAccessError,
  LeadConversionError,
  LeadDuplicateResolutionRequiredError,
  LeadIdempotencyConflictError,
  LeadValidationError,
  LeadVersionConflictError,
} from "@/lib/lead/lead-service";
import { parseBangkokDateTime } from "@/lib/ai/bangkok-date-time";
import { ACTIVITY_TYPES } from "@/lib/constants";
import { createLeadAuditWriter, createLeadRuntime } from "@/lib/lead/lead-runtime";
import { buildLeadScopeWhere } from "@/lib/lead/prisma-lead-repository";
import { calculateLeadScore, evaluateQualification, LEAD_ACTIVITY_ROLES, LEAD_ASSIGNER_ROLES, LEAD_CORE_UPDATE_ROLES } from "@/lib/lead/lead-rules";
import { prisma } from "@/lib/prisma";

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
};

async function actor() {
  const session = await requireSession();
  return { ...session, authorization: await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role }) };
}

function leadInput(formData: FormData) {
  return {
    company: text(formData, "company"),
    contactName: text(formData, "contactName"),
    contactEmail: text(formData, "contactEmail"),
    contactPhone: text(formData, "contactPhone") || undefined,
    source: text(formData, "source"),
    status: text(formData, "status"),
    score: Number(text(formData, "score")),
    recommendedProducts: text(formData, "recommendedProducts") || undefined,
    notes: text(formData, "notes") || undefined,
    disqualificationReason: text(formData, "disqualificationReason") || undefined,
    customerId: text(formData, "customerId") || undefined,
  };
}

function failure(error: unknown): FormState {
  if (error instanceof LeadValidationError) return { errors: error.issues };
  if (error instanceof LeadVersionConflictError) return { message: "Lead ถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดหน้าใหม่ก่อนบันทึก" };
  if (error instanceof LeadDuplicateResolutionRequiredError) return { message: `พบ Customer ที่อาจซ้ำ ${error.duplicateCount} รายการ กรุณาเลือก Customer เดิมหรือระบุเหตุผล override อย่างน้อย 5 ตัวอักษร` };
  if (error instanceof LeadConversionError) return { message: "ต้องเปลี่ยนสถานะ Lead เป็นผ่านการคัดกรองก่อน Convert" };
  if (error instanceof LeadAccessError || error instanceof LeadIdempotencyConflictError) return { message: "ไม่สามารถดำเนินการกับ Lead หรือ Customer นี้ได้" };
  if (error instanceof PermissionDeniedError) return { message: "บัญชีนี้ไม่มีสิทธิ์ดำเนินการกับ Lead" };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { message: "เลขนิติบุคคลนี้มีอยู่แล้ว กรุณาเชื่อม Customer เดิมแทนการสร้างใหม่" };
  throw error;
}

export async function createLead(_: FormState, formData: FormData): Promise<FormState> {
  const currentActor = await actor();
  try {
    const created = await createLeadRuntime().create(currentActor, { ...leadInput(formData), duplicateOverrideReason: text(formData, "duplicateOverrideReason") || undefined }, crypto.randomUUID(), text(formData, "idempotencyKey") || crypto.randomUUID());
    revalidatePath("/leads");
    revalidatePath("/dashboard");
    redirect(`/leads/${created.id}`);
  } catch (error) { return failure(error); }
}

export async function updateLead(id: string, expectedVersion: number, _: FormState, formData: FormData): Promise<FormState> {
  const currentActor = await actor();
  try {
    await createLeadRuntime().update(currentActor, id, expectedVersion, leadInput(formData), crypto.randomUUID(), text(formData, "idempotencyKey") || crypto.randomUUID());
    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);
    redirect(`/leads/${id}`);
  } catch (error) { return failure(error); }
}

export async function assignLead(id: string, expectedVersion: number, _: FormState, formData: FormData): Promise<FormState> {
  const currentActor = await actor();
  try {
    await createLeadRuntime().assign(currentActor, id, expectedVersion, text(formData, "ownerId"), text(formData, "reason"), crypto.randomUUID(), text(formData, "idempotencyKey") || crypto.randomUUID());
    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);
    redirect(`/leads/${id}`);
  } catch (error) { return failure(error); }
}

const leadActivitySchema = z.object({
  subject: z.string().trim().min(2).max(255),
  type: z.enum(ACTIVITY_TYPES.map(([value]) => value)),
  activityAt: z.string().min(1),
  nextFollowUpAt: z.string().optional(),
  notes: z.string().trim().max(10_000).optional(),
});

export async function addLeadActivity(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const currentActor = await actor();
  if (!currentActor.authorization.assignments.some(item => (LEAD_ACTIVITY_ROLES as readonly string[]).includes(item.role))) return { message: "บัญชีนี้ไม่มีสิทธิ์เพิ่มกิจกรรมใน Lead" };
  const parsed = leadActivitySchema.safeParse({ subject: text(formData, "subject"), type: text(formData, "type"), activityAt: text(formData, "activityAt"), nextFollowUpAt: text(formData, "nextFollowUpAt"), notes: text(formData, "notes") || undefined });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const idempotencyKey = text(formData, "idempotencyKey") || crypto.randomUUID();
  const correlationId = crypto.randomUUID();
  try {
    await prisma.$transaction(async transaction => {
      const receipt = await transaction.leadCommandReceipt.findUnique({ where: { actorId_idempotencyKey_command: { actorId: currentActor.id, idempotencyKey, command: "lead.activity" } } });
      if (receipt) return;
      const lead = await transaction.lead.findFirst({ where: { id, ...buildLeadScopeWhere(currentActor.authorization), status: { notIn: [LeadStatus.CONVERTED, LeadStatus.ARCHIVED] } } });
      if (!lead) throw new LeadAccessError();
      const activityAt = parseBangkokDateTime(parsed.data.activityAt);
      if (!activityAt) throw new LeadValidationError({ activityAt: ["ระบุวันเวลากิจกรรม"] });
      const nextFollowUpAt = parseBangkokDateTime(parsed.data.nextFollowUpAt ?? "");
      await transaction.activity.create({ data: { leadId: lead.id, subject: parsed.data.subject, type: parsed.data.type as ActivityType, dueAt: activityAt, notes: parsed.data.notes || null, ownerId: currentActor.id } });
      const contactActivity = new Set<ActivityType>([ActivityType.CALL, ActivityType.EMAIL, ActivityType.MEETING, ActivityType.SITE_VISIT, ActivityType.ONLINE_MEETING]).has(parsed.data.type as ActivityType);
      const nextStatus = contactActivity && lead.status === LeadStatus.ASSIGNED ? LeadStatus.CONTACTED : lead.status;
      const updated = await transaction.lead.update({ where: { id: lead.id }, data: { ...(contactActivity ? { lastContactedAt: activityAt } : {}), nextFollowUpAt, status: nextStatus, version: { increment: 1 } } });
      if (nextStatus !== lead.status) await transaction.leadStatusHistory.create({ data: { leadId: lead.id, fromStatus: lead.status, toStatus: nextStatus, actorId: currentActor.id, correlationId, reason: "บันทึกการติดต่อครั้งแรก" } });
      await createLeadAuditWriter().append({ actorId: currentActor.id, action: "lead.activity.create", targetType: "Lead", targetId: lead.id, targetVersion: String(updated.version), outcome: "SUCCESS", correlationId, data: { activityType: parsed.data.type } }, { transaction });
      await transaction.leadCommandReceipt.create({ data: { actorId: currentActor.id, idempotencyKey, command: "lead.activity", leadId: lead.id, customerId: lead.customerId, resultVersion: updated.version } });
    });
    revalidatePath(`/leads/${id}`); revalidatePath("/leads"); revalidatePath("/activities");
    redirect(`/leads/${id}`);
  } catch (error) { return failure(error); }
}

const qualificationKeys = ["need", "serviceArea", "budget", "authority", "timeline", "productFit", "legalClearance", "verifiedContact"] as const;
export async function qualifyLead(id: string, expectedVersion: number, _: FormState, formData: FormData): Promise<FormState> {
  const currentActor = await actor();
  if (!currentActor.authorization.assignments.some(item => (LEAD_CORE_UPDATE_ROLES as readonly string[]).includes(item.role))) return { message: "บัญชีนี้ไม่มีสิทธิ์ Qualify Lead" };
  const qualificationData = Object.fromEntries(qualificationKeys.map(key => [key, formData.get(key) === "on"])) as Record<(typeof qualificationKeys)[number], boolean>;
  const evaluation = evaluateQualification(qualificationData);
  const requirementSummary = text(formData, "requirementSummary");
  const estimatedBudget = text(formData, "estimatedBudget");
  const overrideReason = text(formData, "overrideReason");
  if (requirementSummary.length < 5) return { errors: { requirementSummary: ["ระบุสรุปความต้องการอย่างน้อย 5 ตัวอักษร"] } };
  if (!/^\d+(\.\d{1,4})?$/.test(estimatedBudget)) return { errors: { estimatedBudget: ["ระบุมูลค่าประมาณการที่ถูกต้อง"] } };
  const canOverride = currentActor.authorization.assignments.some(item => (LEAD_ASSIGNER_ROLES as readonly string[]).includes(item.role));
  if (!evaluation.complete && (!canOverride || overrideReason.length < 5)) return { message: `ข้อมูล Qualification ยังไม่ครบ: ${evaluation.missing.join(", ")}` };
  const idempotencyKey = text(formData, "idempotencyKey") || crypto.randomUUID(); const correlationId = crypto.randomUUID();
  try {
    await prisma.$transaction(async transaction => {
      const receipt = await transaction.leadCommandReceipt.findUnique({ where: { actorId_idempotencyKey_command: { actorId: currentActor.id, idempotencyKey, command: "lead.qualify" } } }); if (receipt) return;
      const lead = await transaction.lead.findFirst({ where: { id, version: expectedVersion, ...buildLeadScopeWhere(currentActor.authorization), status: { in: [LeadStatus.CONTACTED, LeadStatus.NURTURING, LeadStatus.QUALIFIED] } } }); if (!lead) throw new LeadAccessError();
      const score = calculateLeadScore({ taxId: lead.taxId, email: lead.contactEmail, estimatedBudget, expectedPurchaseAt: lead.expectedPurchaseAt, decisionMakerKnown: qualificationData.authority, numberOfSites: lead.numberOfSites });
      const updated = await transaction.lead.update({ where: { id }, data: { qualificationData, qualificationResult: evaluation.complete ? "QUALIFIED" : `MANAGER_OVERRIDE: ${overrideReason}`, requirementSummary, estimatedBudget, score: score.score, temperature: score.temperature, scoreBreakdown: score.breakdown, status: LeadStatus.QUALIFIED, version: { increment: 1 } } });
      if (lead.status !== LeadStatus.QUALIFIED) await transaction.leadStatusHistory.create({ data: { leadId: id, fromStatus: lead.status, toStatus: LeadStatus.QUALIFIED, actorId: currentActor.id, correlationId, reason: overrideReason || "Qualification checklist complete" } });
      await createLeadAuditWriter().append({ actorId: currentActor.id, action: "lead.qualify", targetType: "Lead", targetId: id, targetVersion: String(updated.version), outcome: "SUCCESS", correlationId, reason: overrideReason || undefined, data: { completeness: evaluation.completeness, score: score.score, temperature: score.temperature } }, { transaction });
      await transaction.leadCommandReceipt.create({ data: { actorId: currentActor.id, idempotencyKey, command: "lead.qualify", leadId: id, customerId: lead.customerId, resultVersion: updated.version } });
    });
    revalidatePath(`/leads/${id}`); revalidatePath("/leads"); redirect(`/leads/${id}`);
  } catch (error) { return failure(error); }
}

export async function convertLead(id: string, expectedVersion: number, _: FormState, formData: FormData): Promise<FormState> {
  const currentActor = await actor();
  try {
    const converted = await createLeadRuntime().convert(currentActor, id, {
      expectedVersion,
      conversionMode: text(formData, "conversionMode"),
      existingCustomerId: text(formData, "existingCustomerId") || undefined,
      taxId: text(formData, "taxId") || undefined,
      type: text(formData, "type") || undefined,
      segment: text(formData, "segment") || undefined,
      province: text(formData, "province") || undefined,
      duplicateOverrideReason: text(formData, "duplicateOverrideReason") || undefined,
      opportunityName: text(formData, "opportunityName"),
      opportunityFlow: text(formData, "opportunityFlow"),
      estimatedValue: text(formData, "estimatedValue"),
      expectedCloseAt: text(formData, "expectedCloseAt"),
      probability: Number(text(formData, "probability")),
      productInterest: text(formData, "productInterest") || undefined,
    }, crypto.randomUUID(), text(formData, "idempotencyKey") || crypto.randomUUID());
    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);
    revalidatePath("/customers");
    revalidatePath("/opportunities");
    redirect(`/opportunities/${converted.opportunityId}`);
  } catch (error) { return failure(error); }
}

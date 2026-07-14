"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createWorkflowAdminRuntime } from "@/lib/administration/workflow-admin-runtime";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const date = (value: string) => new Date(`${value}T00:00:00+07:00`);
const nullableDate = (value: string) => value ? date(value) : null;

async function execute(work: (actor: Awaited<ReturnType<typeof requireSession>>, service: ReturnType<typeof createWorkflowAdminRuntime>, correlationId: string) => Promise<unknown>) {
  const actor = await requireSession(); await work(actor, createWorkflowAdminRuntime(), crypto.randomUUID()); revalidatePath("/admin/workflow");
}

export async function createTransitionPolicy(form: FormData) { return execute((actor, service, id) => service.createTransitionPolicy(actor, { policyCode: text(form, "policyCode"), command: text(form, "command"), fromStage: text(form, "fromStage"), toStage: text(form, "toStage"), requiredFields: text(form, "requiredFields").split(",").map((v) => v.trim()).filter(Boolean), requiredPermission: text(form, "requiredPermission"), effectiveFrom: date(text(form, "effectiveFrom")), effectiveTo: nullableDate(text(form, "effectiveTo")) }, id)); }
export async function createApprovalPolicy(form: FormData) { return execute((actor, service, id) => service.createApprovalPolicy(actor, { code: text(form, "code"), definition: JSON.parse(text(form, "definition")), effectiveFrom: date(text(form, "effectiveFrom")), effectiveTo: nullableDate(text(form, "effectiveTo")) }, id)); }
export async function createAuthorityGrant(form: FormData) { return execute((actor, service, id) => service.createAuthorityGrant(actor, { roleCode: text(form, "roleCode"), permissionCode: text(form, "permissionCode"), organizationUnitId: text(form, "organizationUnitId") || null, customerSegment: text(form, "customerSegment") || null, maximumAmount: text(form, "maximumAmount"), effectiveFrom: date(text(form, "effectiveFrom")), effectiveTo: nullableDate(text(form, "effectiveTo")) }, id)); }
export async function createRoleAssignment(form: FormData) { return execute((actor, service, id) => service.createRoleAssignment(actor, { userId: text(form, "userId"), roleCode: text(form, "roleCode"), scopeCode: text(form, "scopeCode"), organizationUnitId: text(form, "organizationUnitId") || null, effectiveFrom: date(text(form, "effectiveFrom")), effectiveTo: nullableDate(text(form, "effectiveTo")) }, id)); }
export async function confirmProductCost(form: FormData) { return execute((actor, service, id) => service.confirmProductCost(actor, { productId: text(form, "productId"), standardCost: text(form, "standardCost"), confirmedAt: date(text(form, "confirmedAt")) }, id)); }

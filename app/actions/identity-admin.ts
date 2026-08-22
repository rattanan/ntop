"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import type { FormState } from "../action-types";
import { requirePermission } from "@/lib/authorization/require-permission";
import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import { createIdentityAdminRuntime } from "@/lib/administration/identity-admin-runtime";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const date = (value: string) => new Date(`${value}T00:00:00+07:00`);
const nullableDate = (value: string) => value ? date(value) : null;

async function execute(work: (actor: Awaited<ReturnType<typeof requirePermission>>, correlationId: string) => Promise<unknown>): Promise<FormState> {
  try {
    const actor = await requirePermission(PERMISSIONS.userAdminManage);
    const result = await work(actor, crypto.randomUUID());
    revalidatePath("/admin/users");
    revalidatePath("/admin/workflow");
    const credential = result && typeof result === "object" && "apiKey" in result
      ? result as { apiKey?: string; apiKeyPrefix?: string }
      : null;
    return { message: "บันทึกเรียบร้อย", status: "success", apiKey: credential?.apiKey, apiKeyPrefix: credential?.apiKeyPrefix };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { message: "ข้อมูลนี้มีอยู่แล้ว" };
    return { message: error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลได้" };
  }
}

export async function createAdminUser(_: FormState, form: FormData) {
  return execute((actor, id) => createIdentityAdminRuntime().createUser(actor, { name: text(form, "name"), email: text(form, "email"), password: text(form, "password"), role: text(form, "role") }, id));
}

export async function updateAdminUser(_: FormState, form: FormData) {
  return execute((actor, id) => createIdentityAdminRuntime().updateUser(actor, { id: text(form, "userId"), name: text(form, "name"), role: text(form, "role"), active: form.get("active") === "on" }, id));
}

export async function rotateAdminUserApiKey(_: FormState, form: FormData) {
  return execute((actor, id) => createIdentityAdminRuntime().rotateUserApiKey(actor, text(form, "userId"), id));
}

export async function assignAdminRole(_: FormState, form: FormData) {
  return execute((actor, id) => createIdentityAdminRuntime().createRoleAssignment(actor, { userId: text(form, "userId"), roleCode: text(form, "roleCode"), scopeCode: text(form, "scopeCode"), organizationUnitId: text(form, "organizationUnitId") || null, effectiveFrom: date(text(form, "effectiveFrom")), effectiveTo: nullableDate(text(form, "effectiveTo")) }, id));
}

export async function updateAdminRoleOrganization(_: FormState, form: FormData) {
  return execute((actor, id) => createIdentityAdminRuntime().updateRoleAssignmentOrganization(actor, { assignmentId: text(form, "assignmentId"), organizationUnitId: text(form, "organizationUnitId") || null }, id));
}

export async function revokeAdminRole(_: FormState, form: FormData) {
  return execute((actor, id) => createIdentityAdminRuntime().revokeRoleAssignment(actor, text(form, "assignmentId"), id));
}

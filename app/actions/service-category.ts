"use server";

import { revalidatePath } from "next/cache";

import type { FormState } from "@/app/action-types";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import {
  createServiceCategory,
  deleteServiceCategory,
  ServiceCategoryAccessError,
  ServiceCategoryCodeConflictError,
  ServiceCategoryInUseError,
  ServiceCategoryValidationError,
  ServiceCategoryVersionConflictError,
  updateServiceCategory,
} from "@/lib/presales/service-category-service";

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
};
const checked = (form: FormData, key: string) => form.get(key) === "on";

async function actor() {
  const session = await requireSession();
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  return { ...session, authorization };
}

function input(form: FormData) {
  return {
    code: text(form, "code").toUpperCase().replaceAll(/\s+/g, "_"),
    name: text(form, "name"),
    displayOrder: Number(text(form, "displayOrder")),
    requiresSiteSurvey: checked(form, "requiresSiteSurvey"),
    requiresBoq: checked(form, "requiresBoq"),
    requiresPhysicalInstallation: checked(form, "requiresPhysicalInstallation"),
    active: checked(form, "active"),
  };
}

function failure(error: unknown): FormState {
  if (error instanceof ServiceCategoryValidationError) return { message: error.message, errors: error.issues };
  if (error instanceof ServiceCategoryCodeConflictError || error instanceof ServiceCategoryVersionConflictError || error instanceof ServiceCategoryAccessError || error instanceof ServiceCategoryInUseError) return { message: error.message };
  return { message: "ไม่สามารถบันทึก Service Category ได้" };
}

export async function createServiceCategoryAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await createServiceCategory(await actor(), input(form), crypto.randomUUID());
    revalidatePath("/admin/service-categories");
    revalidatePath("/products/new");
    return { message: "เพิ่ม Service Category เรียบร้อย", status: "success" };
  } catch (error) { return failure(error); }
}

export async function updateServiceCategoryAction(id: string, _: FormState, form: FormData): Promise<FormState> {
  try {
    await updateServiceCategory(await actor(), id, { ...input(form), expectedVersion: Number(text(form, "expectedVersion")) }, crypto.randomUUID());
    revalidatePath("/admin/service-categories");
    revalidatePath(`/admin/service-categories/${id}`);
    revalidatePath(`/admin/service-categories/${id}/edit`);
    revalidatePath("/products");
    revalidatePath("/products/new");
    revalidatePath("/solution-designs");
    return { message: "แก้ไข Service Category เรียบร้อย", status: "success" };
  } catch (error) { return failure(error); }
}

export async function deleteServiceCategoryAction(id: string, _: FormState, form: FormData): Promise<FormState> {
  try {
    await deleteServiceCategory(await actor(), id, {
      expectedVersion: Number(text(form, "expectedVersion")),
    }, crypto.randomUUID());
    revalidatePath("/admin/service-categories");
    revalidatePath(`/admin/service-categories/${id}`);
    revalidatePath("/products/new");
    revalidatePath("/solution-designs");
    return { message: "ปิดใช้งานและลบ Service Category แล้ว", status: "success" };
  } catch (error) { return failure(error); }
}

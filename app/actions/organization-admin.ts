"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import type { FormState } from "../action-types";
import { createOrganizationAdminRuntime } from "@/lib/administration/organization-admin-runtime";
import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import { requirePermission } from "@/lib/authorization/require-permission";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const date = (value: string) => new Date(`${value}T00:00:00+07:00`);
const nullableDate = (value: string) => (value ? date(value) : null);

async function execute(
  work: (
    actor: Awaited<ReturnType<typeof requirePermission>>,
    correlationId: string,
  ) => Promise<unknown>,
): Promise<FormState> {
  try {
    const actor = await requirePermission(PERMISSIONS.organizationManage);
    await work(actor, crypto.randomUUID());
    revalidatePath("/admin/organization");
    revalidatePath("/admin/users");
    revalidatePath("/admin/workflow");
    return { message: "บันทึกเรียบร้อย", status: "success" };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { message: "ข้อมูลนี้มีอยู่แล้ว" };
    }
    return {
      message: error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลได้",
    };
  }
}

export async function createOrganizationUnit(_: FormState, form: FormData) {
  return execute((actor, correlationId) =>
    createOrganizationAdminRuntime().createOrganizationUnit(
      actor,
      {
        code: text(form, "code"),
        name: text(form, "name"),
        parentId: text(form, "parentId") || null,
      },
      correlationId,
    ),
  );
}

export async function updateOrganizationHierarchy(_: FormState, form: FormData) {
  return execute((actor, correlationId) =>
    createOrganizationAdminRuntime().updateHierarchy(
      actor,
      {
        organizationUnitId: text(form, "organizationUnitId"),
        parentId: text(form, "parentId") || null,
      },
      correlationId,
    ),
  );
}

export async function assignOrganizationApprover(_: FormState, form: FormData) {
  return execute((actor, correlationId) =>
    createOrganizationAdminRuntime().assignManagerApprover(
      actor,
      {
        userId: text(form, "userId"),
        organizationUnitId: text(form, "organizationUnitId"),
        roleCode: text(form, "roleCode"),
        maximumAmount: text(form, "maximumAmount"),
        customerSegment: text(form, "customerSegment") || null,
        effectiveFrom: date(text(form, "effectiveFrom")),
        effectiveTo: nullableDate(text(form, "effectiveTo")),
      },
      correlationId,
    ),
  );
}

"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/app/action-types";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PermissionDeniedError } from "@/lib/authorization/permission-policy";
import {
  CustomerAccessError,
  CustomerIdentityConflictError,
  CustomerIdempotencyConflictError,
  CustomerMergeError,
  CustomerRelationshipError,
  CustomerValidationError,
  CustomerVersionConflictError,
} from "@/lib/customer/customer-service";
import { createCustomerRuntime } from "@/lib/customer/customer-runtime";

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
};

async function actor() {
  const session = await requireSession();
  return {
    ...session,
    authorization: await loadAuthorizationContext({
      actorId: session.id,
      legacyRole: session.role,
    }),
  };
}

function command(formData: FormData, actorId: string) {
  const sourceSystem = text(formData, "externalSource");
  const externalId = text(formData, "externalId");
  const contactName = text(formData, "contactName");
  return {
    name: text(formData, "name"),
    taxId: text(formData, "taxId"),
    type: text(formData, "type"),
    segment: text(formData, "segment"),
    province: text(formData, "province"),
    address: text(formData, "address") || undefined,
    status: text(formData, "status"),
    ownerId: text(formData, "ownerId") || actorId,
    organizationUnitId: text(formData, "organizationUnitId") || null,
    externalIds:
      sourceSystem && externalId ? [{ sourceSystem, externalId }] : [],
    contact: contactName
      ? {
          id: text(formData, "contactId") || undefined,
          name: contactName,
          title: text(formData, "contactTitle") || undefined,
          phone: text(formData, "contactPhone") || undefined,
          email: text(formData, "contactEmail") || undefined,
          relationship:
            text(formData, "contactRelationship") || undefined,
          purpose: text(formData, "contactPurpose") || undefined,
          isPrimary: formData.get("contactIsPrimary") === "on",
        }
      : undefined,
  };
}

function contactCommand(formData: FormData) {
  return {
    name: text(formData, "name"),
    title: text(formData, "title") || undefined,
    phone: text(formData, "phone") || undefined,
    email: text(formData, "email") || undefined,
    relationship: text(formData, "relationship") || undefined,
    purpose: text(formData, "purpose") || undefined,
    isPrimary: formData.get("isPrimary") === "on",
  };
}

function failure(error: unknown): FormState {
  if (error instanceof CustomerValidationError) {
    return { errors: error.issues };
  }
  if (error instanceof CustomerVersionConflictError) {
    return {
      message:
        "ข้อมูลลูกค้าถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดหน้าใหม่ก่อนบันทึก",
    };
  }
  if (
    error instanceof CustomerAccessError ||
    error instanceof CustomerIdentityConflictError ||
    error instanceof CustomerIdempotencyConflictError ||
    error instanceof CustomerMergeError ||
    error instanceof CustomerRelationshipError
  ) {
    return { message: "ไม่สามารถดำเนินการกับข้อมูลลูกค้านี้ได้" };
  }
  if (error instanceof PermissionDeniedError) return { message: "บัญชีนี้ไม่มีสิทธิ์แก้ไขข้อมูลลูกค้า" };
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return { message: "เลขนิติบุคคลหรือ External ID นี้มีอยู่แล้ว" };
  }
  throw error;
}

export async function createCustomerContact(customerId: string, expectedVersion: number, _: FormState, formData: FormData): Promise<FormState> {
  const currentActor = await actor();
  try {
    await createCustomerRuntime().createContact(currentActor, customerId, expectedVersion, contactCommand(formData), crypto.randomUUID(), text(formData, "idempotencyKey") || crypto.randomUUID());
    revalidatePath(`/customers/${customerId}`);
    redirect(`/customers/${customerId}?tab=contacts#contacts`);
  } catch (error) { return failure(error); }
}

export async function updateCustomerContact(customerId: string, contactId: string, expectedVersion: number, _: FormState, formData: FormData): Promise<FormState> {
  const currentActor = await actor();
  try {
    await createCustomerRuntime().updateContact(currentActor, customerId, contactId, expectedVersion, contactCommand(formData), crypto.randomUUID(), text(formData, "idempotencyKey") || crypto.randomUUID());
    revalidatePath(`/customers/${customerId}`);
    redirect(`/customers/${customerId}?tab=contacts#contacts`);
  } catch (error) { return failure(error); }
}

export async function createCustomer(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const currentActor = await actor();
  try {
    const created = await createCustomerRuntime().create(
      currentActor,
      command(formData, currentActor.id),
      crypto.randomUUID(),
    );
    revalidatePath("/customers");
    redirect("/customers/" + created.id);
  } catch (error) {
    return failure(error);
  }
}

export async function updateCustomer(
  id: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const currentActor = await actor();
  const expectedVersion = Number(text(formData, "expectedVersion"));
  try {
    await createCustomerRuntime().update(
      currentActor,
      id,
      Number.isInteger(expectedVersion) && expectedVersion > 0
        ? expectedVersion
        : undefined,
      command(formData, currentActor.id),
      crypto.randomUUID(),
    );
    revalidatePath("/customers");
    revalidatePath("/customers/" + id);
    redirect("/customers/" + id);
  } catch (error) {
    return failure(error);
  }
}

export async function addCustomerRelationship(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const currentActor = await actor();
  const parentCustomerId = text(formData, "parentCustomerId");
  try {
    await createCustomerRuntime().addRelationship(
      currentActor,
      {
        parentCustomerId,
        childCustomerId: text(formData, "childCustomerId"),
        relationshipType: text(formData, "relationshipType"),
        effectiveFrom: new Date(),
      },
      crypto.randomUUID(),
    );
    revalidatePath("/customers/" + parentCustomerId);
    return { message: "เพิ่ม Customer hierarchy แล้ว", status: "success" };
  } catch (error) {
    return failure(error);
  }
}

export async function mergeCustomer(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const currentActor = await actor();
  const targetCustomerId = text(formData, "targetCustomerId");
  try {
    await createCustomerRuntime().merge(
      currentActor,
      {
        sourceCustomerId: text(formData, "sourceCustomerId"),
        targetCustomerId,
        reason: text(formData, "reason"),
      },
      crypto.randomUUID(),
    );
    revalidatePath("/customers");
    revalidatePath("/customers/" + targetCustomerId);
    redirect(`/customers/${targetCustomerId}?tab=governance`);
  } catch (error) {
    return failure(error);
  }
}

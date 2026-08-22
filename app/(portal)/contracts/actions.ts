"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import type { FormState } from "@/app/action-types";
import { safeErrorIdentity } from "@/lib/api/safe-error-identity";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { contractCreateSchema } from "@/lib/contract/contracts";
import { createContractRuntime } from "@/lib/contract/contract-runtime";
import { ContractAccessError } from "@/lib/contract/contract-service";

function text(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function optionalDate(form: FormData, name: string) {
  const value = text(form, name);
  return value ? `${value}T00:00:00.000Z` : null;
}

function unavailableQuoteState(): FormState {
  return {
    message: "Quote Version นี้ถูกนำไปสร้างสัญญาแล้ว หรือไม่อยู่ในขอบเขตที่คุณเข้าถึงได้ กรุณาเลือก Quote อื่น",
    status: "error",
  };
}

export async function createContractAction(_: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const correlationId = crypto.randomUUID();
  const count = Number(form.get("itemCount"));

  try {
    if (!Number.isInteger(count) || count < 1 || count > 1000) {
      return { message: "จำนวนรายการบริการต้องอยู่ระหว่าง 1–1,000 รายการ", status: "error" };
    }
    const items = Array.from({ length: count }, (_, index) => ({
      productId: text(form, `productId.${index}`) || null,
      productCode: text(form, `productCode.${index}`),
      serviceName: text(form, `serviceName.${index}`),
      description: null,
      quantity: text(form, `quantity.${index}`) || "0",
      unit: text(form, `unit.${index}`) || "unit",
      monthlyCharge: text(form, `monthlyCharge.${index}`) || "0",
      oneTimeCharge: text(form, `oneTimeCharge.${index}`) || "0",
      discountAmount: text(form, `discountAmount.${index}`) || "0",
      durationMonths: Number(form.get(`durationMonths.${index}`) ?? 12),
      installationRequired: false,
      sortOrder: index,
    }));
    const input = contractCreateSchema.parse({
      quoteVersionId: text(form, "quoteVersionId"),
      contractTypeCode: text(form, "contractTypeCode"),
      name: text(form, "name"),
      startDate: optionalDate(form, "startDate"),
      endDate: optionalDate(form, "endDate"),
      paymentTerm: text(form, "paymentTerm") || null,
      billingCycle: text(form, "billingCycle") || null,
      taxRate: text(form, "taxRate") || "0",
      terms: text(form, "terms") || null,
      remarks: text(form, "remarks") || null,
      items,
    });
    const result = await createContractRuntime().service.create(
      { ...session, authorization },
      input,
      correlationId,
    );
    revalidatePath("/contracts");
    revalidatePath("/contracts/new");
    redirect(`/contracts/${result.id}`);
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        message: "กรุณาตรวจสอบข้อมูลสัญญาและรายการบริการที่ระบุ",
        errors: error.flatten().fieldErrors as Record<string, string[]>,
        status: "error",
      };
    }
    if (error instanceof ContractAccessError) return unavailableQuoteState();
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return unavailableQuoteState();
    if (typeof error === "object" && error !== null && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
    console.error("contract_create_action_failed", { correlationId, error: safeErrorIdentity(error) });
    return {
      message: `ไม่สามารถสร้างสัญญาได้ กรุณาลองอีกครั้ง (Correlation ID: ${correlationId})`,
      status: "error",
    };
  }
}

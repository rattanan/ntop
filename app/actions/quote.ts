"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import type { FormState } from "@/app/action-types";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { createQuoteRuntime } from "@/lib/commercial/quote-runtime";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function quoteItems(form: FormData) {
  const value: unknown = JSON.parse(text(form, "itemsJson") || "[]");
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) throw new Error("ต้องมีรายการสินค้า 1–100 รายการ");
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("รูปแบบรายการสินค้าไม่ถูกต้อง");
    const line = item as Record<string, unknown>;
    return { productId: String(line.productId ?? "").trim(), quantity: String(line.quantity ?? "").trim(), unitPrice: String(line.unitPrice ?? "").trim(), discountPct: String(line.discountPct ?? "0").trim() };
  });
}

export async function createGovernedQuote(_: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  try {
    const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    await createQuoteRuntime().createVersion(
      { ...session, authorization },
      {
        proposalId: text(form, "proposalId") || undefined,
        opportunityId: text(form, "opportunityId"),
        currency: "THB",
        validUntil: text(form, "validUntil") ? new Date(`${text(form, "validUntil")}T16:59:59.999Z`) : null,
        notes: text(form, "notes") || undefined,
        items: quoteItems(form),
      },
      crypto.randomUUID(),
      text(form, "idempotencyKey"),
    );
  } catch (error) {
    return { message: error instanceof Error ? error.message : "ไม่สามารถสร้างใบเสนอราคาได้" };
  }
  revalidatePath("/quotes");
  redirect("/quotes");
}

export async function submitQuoteVersion(quoteId: string, quoteVersionId: string, _: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  try {
    const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    await createQuoteRuntime().submit({ ...session, authorization }, quoteVersionId, crypto.randomUUID(), text(form, "idempotencyKey"));
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath("/quotes");
    return { message: "ส่งขออนุมัติเรียบร้อย", status: "success" };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "ไม่สามารถส่งอนุมัติได้" };
  }
}

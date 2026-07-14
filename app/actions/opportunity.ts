"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/app/action-types";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { createOpportunityRuntime } from "@/lib/opportunity/opportunity-runtime";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function profile(form: FormData, actorId: string) {
  return {
    name: text(form, "name"), customerId: text(form, "customerId"), flow: text(form, "flow"),
    estimatedValue: text(form, "estimatedValue"), currency: text(form, "currency") || "THB",
    probability: Number(text(form, "probability")), forecastCategory: text(form, "forecastCategory") || "PIPELINE",
    expectedCloseAt: text(form, "expectedCloseAt") ? new Date(`${text(form, "expectedCloseAt")}T00:00:00+07:00`) : null,
    ownerId: text(form, "ownerId") || actorId, nextAction: text(form, "nextAction") || null,
    requirements: text(form, "requirements") || null,
    qualificationResult: text(form, "qualificationResult") || null,
    stakeholderSummary: text(form, "stakeholderSummary") || null,
    assessment: { incumbentVendor: text(form, "incumbentVendor") || null, competitors: text(form, "competitors") || null, approach: text(form, "approach"), confidence: Number(text(form, "confidence")), rationale: text(form, "rationale") || null },
  };
}

async function actor() {
  const session = await requireSession();
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  return { session, authorization };
}

export async function createOpportunity(_: FormState, form: FormData): Promise<FormState> {
  const { session, authorization } = await actor();
  try {
    const created = await createOpportunityRuntime().create({ ...session, authorization }, profile(form, session.id), crypto.randomUUID(), crypto.randomUUID());
    revalidatePath("/opportunities"); redirect(`/opportunities/${created.id}`);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    return { message: error instanceof Error ? error.message : "ไม่สามารถบันทึกโอกาสขายได้" };
  }
}

export async function updateOpportunity(id: string, expectedVersion: number, _: FormState, form: FormData): Promise<FormState> {
  const { session, authorization } = await actor();
  try {
    await createOpportunityRuntime().update({ ...session, authorization }, id, expectedVersion, profile(form, session.id), crypto.randomUUID(), crypto.randomUUID());
    revalidatePath("/opportunities"); revalidatePath(`/opportunities/${id}`); redirect(`/opportunities/${id}`);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    return { message: error instanceof Error ? error.message : "ไม่สามารถบันทึกโอกาสขายได้" };
  }
}

export async function transitionOpportunity(id: string, _: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  try {
    const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    await createOpportunityRuntime().transition(
      { ...session, authorization },
      id,
      {
        targetStage: text(form, "targetStage") as "QUALIFY" | "DISCOVER" | "SOLUTION" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST" | "CANCELLED" | "EXPIRED",
        command: text(form, "command") as "FORWARD" | "RETURN" | "LOST" | "REOPEN" | "CANCEL" | "EXPIRE" | "WON",
        reason: text(form, "reason") || undefined,
        expectedVersion: Number(text(form, "expectedVersion")),
        lostReason: text(form, "lostReason") || undefined,
        lostCategory: text(form, "lostCategory") || undefined,
        cancelledReason: text(form, "cancelledReason") || undefined,
        expectedCloseAt: text(form, "expectedCloseAt") ? new Date(text(form, "expectedCloseAt")) : undefined,
      },
      crypto.randomUUID(),
      text(form, "idempotencyKey"),
    );
    revalidatePath(`/opportunities/${id}`);
    revalidatePath("/opportunities");
    return { message: "เปลี่ยนขั้นตอนขายเรียบร้อย", status: "success" };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "ไม่สามารถเปลี่ยนขั้นตอนขายได้" };
  }
}

export async function overrideOpportunityProbability(id: string, _: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  try {
    const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    await createOpportunityRuntime().overrideProbability(
      { ...session, authorization },
      id,
      { probability: Number(text(form, "probability")), reason: text(form, "reason"), expectedVersion: Number(text(form, "expectedVersion")) },
      crypto.randomUUID(),
      text(form, "idempotencyKey"),
    );
    revalidatePath(`/opportunities/${id}`);
    revalidatePath("/opportunities");
    return { message: "อัปเดต Probability และบันทึกประวัติแล้ว", status: "success" };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "ไม่สามารถปรับ Probability ได้" };
  }
}

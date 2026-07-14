"use server";

import { revalidatePath } from "next/cache";

import type { FormState } from "@/app/action-types";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { createApprovalRuntime } from "@/lib/commercial/approval-runtime";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function decideApproval(requestId: string, stepId: string, expectedVersion: number, _: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  try {
    const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
    await createApprovalRuntime().decide(
      { ...session, authorization },
      { requestId, stepId, expectedVersion, action: text(form, "decision") as "APPROVE" | "REJECT" | "RETURN" | "DELEGATE" | "ESCALATE", reason: text(form, "reason"), delegateToActorId: text(form, "delegateToActorId") || undefined },
      crypto.randomUUID(),
      text(form, "idempotencyKey"),
    );
    revalidatePath(`/approvals/${requestId}`);
    revalidatePath("/approvals");
    return { message: "บันทึกคำตัดสินเรียบร้อย", status: "success" };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "ไม่สามารถบันทึกคำตัดสินได้" };
  }
}

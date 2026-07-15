"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/app/action-types";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { proposalCreateSchema, proposalEditSchema, proposalRestoreSchema, proposalTransitionSchema } from "@/lib/proposal/contracts";
import { createProposalRuntime } from "@/lib/proposal/proposal-runtime";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const tags = (form: FormData) => text(form, "tags").split(",").map((value) => value.trim()).filter(Boolean);
const bangkokEndOfDate = (value: string) => value ? `${value}T23:59:59.999+07:00` : null;

async function actor() {
  const session = await requireSession();
  return { ...session, authorization: await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role }) };
}

export async function createProposal(_: FormState, form: FormData): Promise<FormState> {
  try {
    const input = proposalCreateSchema.parse({
      opportunityId: text(form, "opportunityId"),
      name: text(form, "name"),
      description: text(form, "description") || null,
      expireDate: bangkokEndOfDate(text(form, "expireDate")),
      tags: tags(form),
      templateId: text(form, "templateId") || null,
    });
    const result = await createProposalRuntime().service.create(await actor(), input, crypto.randomUUID(), text(form, "idempotencyKey"));
    revalidatePath("/proposals");
    redirect(`/proposals/${result.id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { message: error instanceof Error ? error.message : "ไม่สามารถสร้าง Proposal ได้" };
  }
}

export async function editProposal(proposalId: string, _: FormState, form: FormData): Promise<FormState> {
  try {
    const input = proposalEditSchema.parse({
      expectedVersion: Number(text(form, "expectedVersion")),
      name: text(form, "name"),
      description: text(form, "description") || null,
      expireDate: bangkokEndOfDate(text(form, "expireDate")),
      tags: tags(form),
      sections: JSON.parse(text(form, "sectionsJson")),
    });
    await createProposalRuntime().service.edit(await actor(), proposalId, input, crypto.randomUUID(), text(form, "idempotencyKey"));
    revalidatePath(`/proposals/${proposalId}`); revalidatePath("/proposals");
    return { message: "บันทึก Proposal version ใหม่แล้ว", status: "success" };
  } catch (error) { return { message: error instanceof Error ? error.message : "ไม่สามารถบันทึก Proposal ได้" }; }
}

export async function transitionProposal(proposalId: string, _: FormState, form: FormData): Promise<FormState> {
  try {
    const input = proposalTransitionSchema.parse({ expectedVersion: Number(text(form, "expectedVersion")), toStatusCode: text(form, "toStatusCode"), comment: text(form, "comment") });
    await createProposalRuntime().service.transition(await actor(), proposalId, input, crypto.randomUUID(), text(form, "idempotencyKey"));
    revalidatePath(`/proposals/${proposalId}`); revalidatePath("/proposals");
    return { message: "เปลี่ยนสถานะ Proposal แล้ว", status: "success" };
  } catch (error) { return { message: error instanceof Error ? error.message : "ไม่สามารถเปลี่ยนสถานะได้" }; }
}

export async function restoreProposal(proposalId: string, _: FormState, form: FormData): Promise<FormState> {
  try {
    const input = proposalRestoreSchema.parse({ expectedVersion: Number(text(form, "expectedVersion")), sourceVersionNumber: Number(text(form, "sourceVersionNumber")) });
    await createProposalRuntime().service.restore(await actor(), proposalId, input, crypto.randomUUID(), text(form, "idempotencyKey"));
    revalidatePath(`/proposals/${proposalId}`);
    return { message: "Restore เป็น version ใหม่แล้ว", status: "success" };
  } catch (error) { return { message: error instanceof Error ? error.message : "ไม่สามารถ restore ได้" }; }
}

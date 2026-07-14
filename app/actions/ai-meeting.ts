"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/app/action-types";
import {
  BangkokDateTimeError,
  parseBangkokDateTime,
} from "@/lib/ai/bangkok-date-time";
import { createMeetingConfirmationRuntime } from "@/lib/ai/meeting-confirmation-runtime";
import { MeetingConfirmationError } from "@/lib/ai/meeting-confirmation-service";
import { MEETING_DRAFT_SCHEMA_VERSION } from "@/lib/ai/meeting-draft-schema";
import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import { requirePermission } from "@/lib/authorization/require-permission";

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
};

const lines = (value: string) =>
  value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

function optionalIso(value: string) {
  try {
    return parseBangkokDateTime(value)?.toISOString() ?? null;
  } catch (error) {
    if (error instanceof BangkokDateTimeError) {
      throw new MeetingConfirmationError();
    }
    throw error;
  }
}

export async function confirmMeetingDraft(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission(PERMISSIONS.aiMeetingDraftConfirm);
  const outputId = text(formData, "outputId");
  const selectedFields = formData
    .getAll("selectedFields")
    .filter((value): value is string => typeof value === "string");
  try {
    const result = await createMeetingConfirmationRuntime().confirm(
      actor,
      {
        idempotencyKey: text(formData, "idempotencyKey"),
        outputId,
        selectedFields,
        finalContent: {
          schemaVersion: MEETING_DRAFT_SCHEMA_VERSION,
          meetingSummary: text(formData, "meetingSummary"),
          keyRequirements: lines(text(formData, "keyRequirements")),
          decisionsAndAgreements: lines(text(formData, "decisionsAndAgreements")),
          actionItems: lines(text(formData, "actionItems")).map((description) => ({
            description,
            suggestedOwner: null,
            suggestedDueAt: null,
          })),
          risksAndConcerns: lines(text(formData, "risksAndConcerns")),
          suggestedNextAction: text(formData, "nextActionDescription")
            ? {
                description: text(formData, "nextActionDescription"),
                suggestedDueAt: optionalIso(text(formData, "nextActionDueAt")),
              }
            : null,
          suggestedActivity: text(formData, "suggestedActivityType")
            ? {
                type: text(formData, "suggestedActivityType"),
                suggestedAt: optionalIso(text(formData, "suggestedActivityAt")),
              }
            : null,
        },
        activitySubject: text(formData, "activitySubject"),
        activityType: text(formData, "activityType"),
        dueAt: optionalIso(text(formData, "dueAt"))
          ? new Date(optionalIso(text(formData, "dueAt")) as string)
          : null,
        customerId: text(formData, "customerId") || undefined,
        opportunityId: text(formData, "opportunityId") || undefined,
        notes: text(formData, "notes") || undefined,
        confirmNextAction: formData.get("confirmNextAction") === "on",
      },
      crypto.randomUUID(),
    );
    revalidatePath("/activities");
    redirect(`/activities?confirmed=${encodeURIComponent(result.activityId)}`);
  } catch (error) {
    if (error instanceof MeetingConfirmationError) {
      return { message: "ไม่สามารถยืนยัน Draft นี้ได้ กรุณาตรวจข้อมูลและสิทธิ์" };
    }
    throw error;
  }
}

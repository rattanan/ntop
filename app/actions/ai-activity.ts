"use server";

import { ActivityType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { FormState } from "@/app/action-types";
import { ACTIVITY_TYPES } from "@/lib/constants";
import { requireSession } from "@/lib/auth";
import { createLegacyMeetingDraft } from "@/lib/ai/legacy-meeting-draft";
import { prisma } from "@/lib/prisma";

const activitySchema = z.object({
  subject: z.string().min(2, "ระบุหัวข้อกิจกรรม"),
  type: z.enum(
    ACTIVITY_TYPES.map(([key]) => key) as [string, ...string[]],
  ),
  dueAt: z.string().optional(),
  notes: z.string().optional(),
  customerId: z.string().optional(),
  opportunityId: z.string().optional(),
});

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function createActivity(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  if (session.role === "VIEWER") {
    return { message: "บัญชีนี้ไม่มีสิทธิ์สร้างข้อมูล" };
  }

  const parsed = activitySchema.safeParse({
    subject: text(formData.get("subject")),
    type: text(formData.get("type")),
    dueAt: text(formData.get("dueAt")),
    notes: text(formData.get("notes")),
    customerId: text(formData.get("customerId")),
    opportunityId: text(formData.get("opportunityId")),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const notes = parsed.data.notes || "";
  const meetingDraft =
    parsed.data.type === "MEETING" ? createLegacyMeetingDraft(notes) : null;

  await prisma.activity.create({
    data: {
      subject: parsed.data.subject,
      type: parsed.data.type as ActivityType,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      notes: notes || null,
      aiSummary: meetingDraft?.summary ?? null,
      actionItems: meetingDraft?.actionItems ?? null,
      customerId: parsed.data.customerId || null,
      opportunityId: parsed.data.opportunityId || null,
      ownerId: session.id,
    },
  });

  revalidatePath("/activities");
  revalidatePath("/dashboard");
  redirect("/activities");
}

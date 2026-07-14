"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/app/action-types";
import {
  BangkokDateTimeError,
  parseBangkokDateTime,
} from "@/lib/ai/bangkok-date-time";
import {
  DealRiskExplanationUnavailableError,
  generateDealRiskExplanation,
} from "@/lib/ai/deal-risk-explanation-runtime";
import {
  createDealRiskRuleRuntime,
  evaluateOpportunityRisks,
} from "@/lib/ai/deal-risk-runtime";
import { DealRiskRuleValidationError } from "@/lib/ai/deal-risk-rule-service";
import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import { requirePermission } from "@/lib/authorization/require-permission";

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
};

const csv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export async function createDealRiskRuleVersion(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission(PERMISSIONS.aiConfigManage);
  try {
    const stages = csv(text(formData, "stages"));
    const segments = csv(text(formData, "segments"));
    await createDealRiskRuleRuntime().createAndActivate(
      actor,
      {
        code: text(formData, "code"),
        riskType: text(formData, "riskType"),
        effectiveFrom:
          parseBangkokDateTime(text(formData, "effectiveFrom")) ??
          new Date(),
        effectiveTo: parseBangkokDateTime(text(formData, "effectiveTo")),
        configuration: {
          condition: {
            metric: text(formData, "metric") as
              | "LAST_ACTIVITY_AGE_DAYS"
              | "CLOSE_DATE_OVERDUE_DAYS"
              | "NEXT_ACTION_MISSING",
            operator: text(formData, "operator") as "GT" | "GTE",
            threshold: Number(text(formData, "threshold")),
            onMissing: text(formData, "onMissing") as "TRIGGER" | "IGNORE",
          },
          scope: {
            ...(stages.length ? { stages } : {}),
            ...(segments.length ? { segments } : {}),
          },
          severity: { band: text(formData, "severityBand") },
        },
      },
      crypto.randomUUID(),
    );
    revalidatePath("/admin/ai-risk");
    return { message: "สร้างและเปิดใช้ Risk Rule version ใหม่แล้ว", status: "success" };
  } catch (error) {
    if (
      error instanceof DealRiskRuleValidationError ||
      error instanceof BangkokDateTimeError
    ) {
      return { message: "ข้อมูล Risk Rule ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง" };
    }
    return { message: "ไม่สามารถบันทึก Risk Rule ได้" };
  }
}

export async function refreshOpportunityRiskSignals(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission(PERMISSIONS.recordUpdate);
  const opportunityId = text(formData, "opportunityId");
  try {
    const result = await evaluateOpportunityRisks(
      actor,
      opportunityId,
      crypto.randomUUID(),
    );
    revalidatePath("/opportunities/" + opportunityId);
    return {
      message:
        "ประเมิน " +
        result.evaluatedRuleCount +
        " rules และพบ " +
        result.signalCount +
        " signals",
    };
  } catch {
    return { message: "ไม่สามารถประเมิน Deal Risk สำหรับ Opportunity นี้ได้" };
  }
}

export async function requestDealRiskExplanation(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission(PERMISSIONS.aiRiskExplain);
  try {
    const result = await generateDealRiskExplanation({
      actor,
      signalId: text(formData, "signalId"),
      idempotencyKey: text(formData, "idempotencyKey"),
      correlationId: crypto.randomUUID(),
    });
    redirect("/ai-risk-explanations/" + result.outputId);
  } catch (error) {
    if (error instanceof DealRiskExplanationUnavailableError) {
      return {
        message:
          "AI explanation ไม่พร้อมใช้งาน แต่ deterministic Risk Signal ยังใช้ได้ตามปกติ",
      };
    }
    throw error;
  }
}

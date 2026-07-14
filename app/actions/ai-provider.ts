"use server";

import { revalidatePath } from "next/cache";

import type { FormState } from "@/app/action-types";
import { requirePermission } from "@/lib/authorization/require-permission";
import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import {
  AiConfigurationRuntimeError,
  createProviderConfigurationRuntime,
  testActiveProviderConnection,
} from "@/lib/ai/provider-configuration-runtime";
import { ProviderConfigurationValidationError } from "@/lib/ai/provider-config-service";

const text = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

export async function updateAiProviderConfiguration(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission(PERMISSIONS.aiConfigManage);
  try {
    await createProviderConfigurationRuntime().service.update(
      actor,
      {
        enabled: formData.get("enabled") === "on",
        apiUrl: text(formData.get("apiUrl")),
        model: text(formData.get("model")),
        requestTimeoutMs: Number(text(formData.get("requestTimeoutMs"))),
        ...(text(formData.get("apiKey"))
          ? { apiKey: String(formData.get("apiKey")) }
          : {}),
      },
      { correlationId: crypto.randomUUID(), reason: "Admin configuration update" },
    );
    revalidatePath("/admin/ai-settings");
    return { message: "บันทึกการตั้งค่า AI แล้ว", status: "success" };
  } catch (error) {
    if (error instanceof ProviderConfigurationValidationError) {
      return { errors: error.issues };
    }
    return { message: "ไม่สามารถบันทึกการตั้งค่า AI ได้" };
  }
}

export async function testAiProviderConnection(): Promise<FormState> {
  const actor = await requirePermission(PERMISSIONS.aiConfigManage);
  try {
    const result = await testActiveProviderConnection(actor.id, crypto.randomUUID());
    return { message: result.message, status: "success" };
  } catch (error) {
    if (error instanceof AiConfigurationRuntimeError) {
      return { message: "ยังไม่มี AI configuration ที่พร้อมใช้งาน" };
    }
    return { message: "ไม่สามารถเชื่อมต่อ AI provider ได้" };
  }
}

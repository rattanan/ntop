import { AiProviderSettingsForm } from "@/components/ai-provider-settings-form";
import { requirePermission } from "@/lib/authorization/require-permission";
import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import {
  AiConfigurationRuntimeError,
  createProviderConfigurationRuntime,
} from "@/lib/ai/provider-configuration-runtime";

export default async function AiSettingsPage() {
  const actor = await requirePermission(PERMISSIONS.aiConfigManage);
  let value = null;
  let unavailable = false;
  try {
    value = await createProviderConfigurationRuntime().service.read(actor);
  } catch (error) {
    if (!(error instanceof AiConfigurationRuntimeError)) throw error;
    unavailable = true;
  }
  return <><div className="page-head"><div><p className="eyebrow">Administration</p><h1>AI Provider Settings</h1></div></div><AiProviderSettingsForm value={value} unavailable={unavailable}/></>;
}

"use client";

import { useActionState } from "react";

import {
  testAiProviderConnection,
  updateAiProviderConfiguration,
} from "@/app/actions/ai-provider";
import type { FormState } from "@/app/action-types";

const initial: FormState = {};

export function AiProviderSettingsForm({
  value,
  unavailable,
}: {
  value: {
    enabled: boolean;
    apiUrl: string;
    model: string;
    requestTimeoutMs: number;
    apiKeyConfigured: boolean;
  } | null;
  unavailable: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateAiProviderConfiguration,
    initial,
  );
  const [testState, testAction, testing] = useActionState(
    testAiProviderConnection,
    initial,
  );
  return <section className="card form-card"><div className="card-body"><div className="form-section"><h2>AI Provider</h2>{unavailable&&<p className="notice">ระบบยังไม่มี AI_CONFIG_MASTER_KEY หรือ migration ที่พร้อมใช้งาน</p>}<form action={action}><div className="form-grid"><label className="field"><span>API URL</span><input className="control" name="apiUrl" required defaultValue={value?.apiUrl}/></label><label className="field"><span>Model</span><input className="control" name="model" required defaultValue={value?.model}/></label><label className="field"><span>Timeout (ms)</span><input className="control" name="requestTimeoutMs" type="number" min="1000" max="120000" required defaultValue={value?.requestTimeoutMs ?? 30000}/></label><label className="field"><span>API Key</span><input className="control" name="apiKey" type="password" autoComplete="new-password" placeholder={value?.apiKeyConfigured?"ตั้งค่าแล้ว — เว้นว่างเพื่อคงค่าเดิม":"กรอก API key"}/></label><label className="field"><span><input name="enabled" type="checkbox" defaultChecked={value?.enabled}/> เปิดใช้งาน AI</span></label></div>{state.message&&<p className="notice">{state.message}</p>}<button className="primary" disabled={pending||unavailable}>{pending?"กำลังบันทึก…":"บันทึก"}</button></form><form action={testAction} style={{marginTop:12}}>{testState.message&&<p className="notice">{testState.message}</p>}<button className="secondary" disabled={testing||unavailable}>{testing?"กำลังทดสอบ…":"Test Connection"}</button></form></div></div></section>;
}

"use client";

import { BrainCircuit, Sparkles } from "lucide-react";
import { useActionState } from "react";

import type { FormState } from "@/app/action-types";
import {
  refreshOpportunityRiskSignals,
  requestDealRiskExplanation,
} from "@/app/actions/ai-risk";
import { FormNotice, Notice } from "./notice";

type SignalView = {
  id: string;
  riskType: string;
  ruleCode: string;
  ruleVersion: number;
  thresholdSnapshot: Record<string, unknown>;
  triggeringFacts: Record<string, unknown>;
  severitySnapshot: Record<string, unknown>;
  evaluatedAt: string;
};

const initialState: FormState = {};

function json(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

function ExplanationButton({ signalId }: { signalId: string }) {
  const [state, action, pending] = useActionState(
    requestDealRiskExplanation,
    initialState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="signalId" value={signalId} />
      <input type="hidden" name="idempotencyKey" value={"risk-explanation:" + signalId} />
      <button className="secondary" disabled={pending}>
        {pending ? "กำลังสร้างคำอธิบาย…" : <><Sparkles aria-hidden="true"/>สร้าง AI Explanation</>}
      </button>
      {state.message && <p className="help">{state.message}</p>}
    </form>
  );
}

function signalSummary(signal:SignalView){
  const metric=String(signal.triggeringFacts.metric??signal.riskType);
  const observed=signal.triggeringFacts.observedValue;
  return observed===undefined?`ตรวจพบความเสี่ยง ${signal.riskType}`:`ตรวจพบ ${metric} ที่ค่า ${String(observed)}`;
}

export function DealRiskPanel({
  opportunityId,
  signals,
  canRefresh,
  canExplain,
  riskPersistenceAvailable,
}: {
  opportunityId: string;
  signals: SignalView[];
  canRefresh: boolean;
  canExplain: boolean;
  riskPersistenceAvailable: boolean;
}) {
  const [state, action, pending] = useActionState(
    refreshOpportunityRiskSignals,
    initialState,
  );
  return (
    <section className="card ai-insight-card opportunity-ai-insight" style={{ marginTop: 20 }}>
      <div className="card-header ai-insight-header"><div><span className="ai-insight-icon"><BrainCircuit aria-hidden="true"/></span><div><strong>AI Insight</strong><small>วิเคราะห์ความเสี่ยงจาก Stage, กิจกรรม, Next action และกำหนดปิดการขาย</small></div></div><span className="badge ai">Deal intelligence</span></div>
      <div className="card-body">
        <p className="help">
          คะแนน Health แสดงความพร้อมโดยรวมของ Opportunity ส่วน AI Insight ด้านล่างชี้ความเสี่ยงเฉพาะเหตุการณ์ กฎและหลักฐานเป็น source of truth; AI ช่วยอธิบายแต่ไม่เปลี่ยนข้อมูลหรือ Stage อัตโนมัติ
        </p>
        {!riskPersistenceAvailable && (
          <Notice variant="error">
            ระบบ Risk Signal ไม่พร้อมใน environment นี้ กรุณาติดต่อผู้ดูแลระบบ
          </Notice>
        )}
        {canRefresh && riskPersistenceAvailable && (
          <form action={action} style={{ margin: "14px 0" }}>
            <input type="hidden" name="opportunityId" value={opportunityId} />
            <button className="secondary" disabled={pending}>
              {pending ? "กำลังวิเคราะห์…" : <><Sparkles aria-hidden="true"/>อัปเดต AI Insight</>}
            </button>
            <FormNotice state={state} />
          </form>
        )}
        {riskPersistenceAvailable && !signals.length && (
          <p className="empty">ยังไม่มี Risk Signal ที่บันทึกไว้</p>
        )}
        {signals.map((signal) => (
          <article key={signal.id} className="card opportunity-risk-signal" style={{ marginTop: 12 }}>
            <div className="card-body">
              <p><span className="badge">{String(signal.severitySnapshot.band ?? "UNSPECIFIED")}</span> {signal.riskType}</p>
              <p data-expandable-text>{signalSummary(signal)}</p>
              <p className="help">Rule {signal.ruleCode} · version {signal.ruleVersion} · ประเมิน {new Date(signal.evaluatedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
              <details><summary>ดูหลักเกณฑ์และหลักฐานการประเมิน</summary><div className="risk-evidence"><strong>Threshold</strong><pre>{json(signal.thresholdSnapshot)}</pre><strong>Facts</strong><pre>{json(signal.triggeringFacts)}</pre></div></details>
              {canExplain && <div style={{ marginTop: 12 }}><ExplanationButton signalId={signal.id} /></div>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useActionState } from "react";

import type { FormState } from "@/app/action-types";
import {
  refreshOpportunityRiskSignals,
  requestDealRiskExplanation,
} from "@/app/actions/ai-risk";

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
        {pending ? "กำลังขอคำอธิบาย…" : "ขอ AI Explanation"}
      </button>
      {state.message && <p className="help">{state.message}</p>}
    </form>
  );
}

export function DealRiskPanel({
  opportunityId,
  signals,
  canRefresh,
  canExplain,
}: {
  opportunityId: string;
  signals: SignalView[];
  canRefresh: boolean;
  canExplain: boolean;
}) {
  const [state, action, pending] = useActionState(
    refreshOpportunityRiskSignals,
    initialState,
  );
  return (
    <section className="card" style={{ marginTop: 20 }}>
      <div className="card-header">Deterministic Deal Risk</div>
      <div className="card-body">
        <p className="help">
          Rule/version, threshold และ facts ด้านล่างเป็น source of truth; AI มีหน้าที่อธิบายเท่านั้น
        </p>
        {canRefresh && (
          <form action={action} style={{ margin: "14px 0" }}>
            <input type="hidden" name="opportunityId" value={opportunityId} />
            <button className="secondary" disabled={pending}>
              {pending ? "กำลังประเมิน…" : "ประเมิน Risk ล่าสุด"}
            </button>
            {state.message && <p className="help">{state.message}</p>}
          </form>
        )}
        {!signals.length && <p className="empty">ยังไม่มี Risk Signal</p>}
        {signals.map((signal) => (
          <article key={signal.id} className="card" style={{ marginTop: 12 }}>
            <div className="card-body">
              <p><span className="badge">{String(signal.severitySnapshot.band ?? "UNSPECIFIED")}</span> {signal.riskType}</p>
              <p className="help">Rule {signal.ruleCode} · version {signal.ruleVersion} · ประเมิน {new Date(signal.evaluatedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
              <details><summary>Threshold snapshot</summary><pre>{json(signal.thresholdSnapshot)}</pre></details>
              <details><summary>Triggering facts</summary><pre>{json(signal.triggeringFacts)}</pre></details>
              {canExplain && <div style={{ marginTop: 12 }}><ExplanationButton signalId={signal.id} /></div>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

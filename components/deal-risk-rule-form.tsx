"use client";

import { useActionState } from "react";

import type { FormState } from "@/app/action-types";
import { createDealRiskRuleVersion } from "@/app/actions/ai-risk";
import { FormNotice } from "./notice";

const initialState: FormState = {};

export function DealRiskRuleForm() {
  const [state, action, pending] = useActionState(
    createDealRiskRuleVersion,
    initialState,
  );
  return (
    <form action={action} className="card form-card">
      <div className="card-body">
        <div className="form-section">
          <h2>สร้างและ Activate Rule Version</h2>
          <p className="help">
            การแก้ไขจะสร้าง version ใหม่เสมอ ประวัติ signal เดิมจะไม่ถูกเปลี่ยน
          </p>
          <div className="form-grid">
            <label className="field">
              <span>Rule code</span>
              <input className="control" name="code" required maxLength={100} />
            </label>
            <label className="field">
              <span>Risk type</span>
              <input className="control" name="riskType" required maxLength={100} />
            </label>
            <label className="field">
              <span>Metric</span>
              <select className="control" name="metric">
                <option value="LAST_ACTIVITY_AGE_DAYS">Last activity age (days)</option>
                <option value="CLOSE_DATE_OVERDUE_DAYS">Close date overdue (days)</option>
                <option value="NEXT_ACTION_MISSING">Next action missing</option>
              </select>
            </label>
            <label className="field">
              <span>Operator</span>
              <select className="control" name="operator">
                <option value="GT">มากกว่า</option>
                <option value="GTE">มากกว่าหรือเท่ากับ</option>
              </select>
            </label>
            <label className="field">
              <span>Threshold</span>
              <input className="control" name="threshold" type="number" min="0" step="1" required />
            </label>
            <label className="field">
              <span>Missing data</span>
              <select className="control" name="onMissing">
                <option value="TRIGGER">Trigger signal</option>
                <option value="IGNORE">Ignore</option>
              </select>
            </label>
            <label className="field">
              <span>Stages (comma separated)</span>
              <input className="control" name="stages" placeholder="เว้นว่างเพื่อใช้ทุก stage" />
            </label>
            <label className="field">
              <span>Segments (comma separated)</span>
              <input className="control" name="segments" placeholder="เว้นว่างเพื่อใช้ทุก segment" />
            </label>
            <label className="field">
              <span>Severity band</span>
              <input className="control" name="severityBand" required maxLength={100} />
            </label>
            <label className="field">
              <span>Effective from (Asia/Bangkok)</span>
              <input className="control" name="effectiveFrom" type="datetime-local" required />
            </label>
            <label className="field">
              <span>Effective to (optional, Asia/Bangkok)</span>
              <input className="control" name="effectiveTo" type="datetime-local" />
            </label>
          </div>
        </div>
        <FormNotice state={state}/>
        <div className="actions">
          <button className="primary" disabled={pending}>
            {pending ? "กำลังบันทึก…" : "สร้าง Rule Version"}
          </button>
        </div>
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";

import type { FormState } from "@/app/action-types";
import { confirmMeetingDraft } from "@/app/actions/ai-meeting";
import type { MeetingDraftOutput } from "@/lib/ai/meeting-draft-schema";
import { FormNotice } from "./notice";

const initialState: FormState = {};

function localDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const bangkok = new Date(date.getTime() + 7 * 60 * 60 * 1_000);
  return bangkok.toISOString().slice(0, 16);
}

export function DealRiskExplanationReviewForm({
  outputId,
  draft,
  opportunity,
}: {
  outputId: string;
  draft: MeetingDraftOutput;
  opportunity: { id: string; name: string; customerId: string; customerName: string };
}) {
  const [state, action, pending] = useActionState(
    confirmMeetingDraft,
    initialState,
  );
  return (
    <form action={action} className="card form-card">
      <div className="card-body">
        <input type="hidden" name="outputId" value={outputId} />
        <input type="hidden" name="idempotencyKey" value={"risk-confirm:" + outputId} />
        <input type="hidden" name="selectedFields" value="meetingSummary" />
        <input type="hidden" name="selectedFields" value="risksAndConcerns" />
        <input type="hidden" name="selectedFields" value="suggestedNextAction" />
        <input type="hidden" name="customerId" value={opportunity.customerId} />
        <input type="hidden" name="opportunityId" value={opportunity.id} />
        <input type="hidden" name="activityType" value="TASK" />
        <input type="hidden" name="dueAt" value="" />
        <input type="hidden" name="keyRequirements" value="" />
        <input type="hidden" name="decisionsAndAgreements" value="" />
        <input type="hidden" name="actionItems" value="" />
        <input type="hidden" name="suggestedActivityType" value="" />
        <div className="form-section">
          <h2><span className="badge">AI Suggestion — ต้องตรวจสอบ</span></h2>
          <p className="help">
            Signal แบบ deterministic ยังคงเป็น source of truth การยืนยันนี้ไม่เปลี่ยน stage, probability หรือราคา
          </p>
          <div className="form-grid">
            <label className="field full">
              <span>คำอธิบาย</span>
              <textarea className="control" name="meetingSummary" rows={4} defaultValue={draft.meetingSummary} required />
            </label>
            <label className="field full">
              <span>Risk / Impact (หนึ่งรายการต่อบรรทัด)</span>
              <textarea className="control" name="risksAndConcerns" rows={3} defaultValue={draft.risksAndConcerns.join("\n")} />
            </label>
            <label className="field full">
              <span>Next Action ที่แนะนำ</span>
              <input className="control" name="nextActionDescription" defaultValue={draft.suggestedNextAction?.description ?? ""} required />
            </label>
            <label className="field">
              <span>กำหนดเวลา (Asia/Bangkok)</span>
              <input className="control" type="datetime-local" name="nextActionDueAt" defaultValue={localDateTime(draft.suggestedNextAction?.suggestedDueAt)} />
            </label>
            <label className="field">
              <span>Opportunity</span>
              <input className="control" value={opportunity.name} disabled />
            </label>
            <label className="field full">
              <span>หัวข้อ Activity หลัก</span>
              <input className="control" name="activitySubject" defaultValue={"ตรวจสอบ Deal Risk: " + opportunity.name} required />
            </label>
            <label className="field full">
              <span>บันทึกเพิ่มเติม</span>
              <textarea className="control" name="notes" rows={2} />
            </label>
            <label className="field full">
              <input type="checkbox" name="confirmNextAction" defaultChecked /> สร้าง Task จาก Next Action หลังยืนยัน
            </label>
          </div>
        </div>
        <FormNotice state={state}/>
        <div className="actions">
          <button className="primary" disabled={pending}>
            {pending ? "กำลังยืนยัน…" : "ยืนยันและสร้าง Activity/Task"}
          </button>
        </div>
      </div>
    </form>
  );
}

"use client";

import { Check, LoaderCircle, Save, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Notice, type NoticeVariant } from "@/components/notice";

type NoticeValue = { text: string; variant: NoticeVariant };

async function jsonMutation<T>(path: string, method: "PATCH" | "POST", body: object): Promise<T> {
  const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? "ดำเนินการไม่สำเร็จ");
  return payload.data as T;
}

export function ActivityResultsForm({ activityId, version, values }: { activityId: string; version: number; values: { outcome: string; customerFeedback: string; nextAction: string } }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<NoticeValue | null>(null);
  return <form className="activity-results-form" onSubmit={async (event) => {
    event.preventDefault(); setPending(true); setNotice(null);
    const form = new FormData(event.currentTarget);
    try {
      await jsonMutation(`/api/v1/activities/${activityId}/results`, "PATCH", { expectedVersion: version, outcome: form.get("outcome"), customerFeedback: form.get("customerFeedback"), nextAction: form.get("nextAction") });
      setNotice({ text: "บันทึกผลลัพธ์ Activity เรียบร้อย", variant: "success" }); router.refresh();
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "บันทึกผลลัพธ์ไม่สำเร็จ", variant: "error" }); }
    finally { setPending(false); }
  }}>
    <label className="field"><span>ผลลัพธ์</span><textarea className="control" name="outcome" defaultValue={values.outcome} maxLength={20_000} rows={4} /></label>
    <label className="field"><span>Customer Feedback</span><textarea className="control" name="customerFeedback" defaultValue={values.customerFeedback} maxLength={20_000} rows={4} /></label>
    <label className="field"><span>Next Action</span><textarea className="control" name="nextAction" defaultValue={values.nextAction} maxLength={20_000} rows={4} /></label>
    {notice && <Notice variant={notice.variant}>{notice.text}</Notice>}
    <div className="actions"><button className="primary" disabled={pending}>{pending ? <><LoaderCircle className="spin" aria-hidden="true" />กำลังบันทึก…</> : <><Save aria-hidden="true" />บันทึกผลลัพธ์</>}</button></div>
  </form>;
}

export function ActivityInsightPanel({ activityId, version, canGenerate, summary, actionItems }: { activityId: string; version: number; canGenerate: boolean; summary: string | null; actionItems: string | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState<{ summary: string; actionItems: string } | null>(null);
  const [pending, setPending] = useState<"generate" | "confirm" | null>(null);
  const [notice, setNotice] = useState<NoticeValue | null>(null);
  const generate = async () => {
    setPending("generate"); setNotice(null);
    try {
      const value = await jsonMutation<{ summary: string; actionItems: string }>(`/api/v1/activities/${activityId}/insight`, "POST", {});
      setDraft(value); setNotice({ text: "AI Draft พร้อมตรวจสอบ กรุณาแก้ไขและยืนยันก่อนบันทึก", variant: "info" });
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "Generate Insight ไม่สำเร็จ", variant: "error" }); }
    finally { setPending(null); }
  };
  return <section className="card ai-activity-card">
    <div className="card-header ai-activity-header"><div><strong>AI Meeting Insight</strong><small>สร้าง Draft จากบันทึกการประชุมและต้องยืนยันโดยผู้ใช้</small></div>{canGenerate && <button type="button" className="secondary" disabled={pending !== null} onClick={() => void generate()}>{pending === "generate" ? <><LoaderCircle className="spin" aria-hidden="true" />กำลังสร้าง…</> : <><Sparkles aria-hidden="true" />Generate AI Meeting Insight</>}</button>}</div>
    <div className="card-body">
      {draft ? <form className="activity-insight-review" onSubmit={async (event) => {
        event.preventDefault(); setPending("confirm"); setNotice(null); const form = new FormData(event.currentTarget);
        try {
          await jsonMutation(`/api/v1/activities/${activityId}/insight/confirm`, "POST", { expectedVersion: version, aiSummary: form.get("aiSummary"), actionItems: form.get("actionItems") });
          setDraft(null); setNotice({ text: "ยืนยันและบันทึก AI Meeting Insight แล้ว", variant: "success" }); router.refresh();
        } catch (error) { setNotice({ text: error instanceof Error ? error.message : "ยืนยัน Insight ไม่สำเร็จ", variant: "error" }); }
        finally { setPending(null); }
      }}>
        <span className="badge ai">AI Draft — รอการยืนยัน</span>
        <label className="field"><span>AI Summary</span><textarea className="control" name="aiSummary" defaultValue={draft.summary} maxLength={20_000} rows={5} required /></label>
        <label className="field"><span>Action Items</span><textarea className="control" name="actionItems" defaultValue={draft.actionItems} maxLength={20_000} rows={4} /></label>
        <div className="actions"><button type="button" className="secondary" disabled={pending !== null} onClick={() => setDraft(null)}>ยกเลิก Draft</button><button className="primary" disabled={pending !== null}>{pending === "confirm" ? <><LoaderCircle className="spin" aria-hidden="true" />กำลังยืนยัน…</> : <><Check aria-hidden="true" />ยืนยันใช้ Insight</>}</button></div>
      </form> : <div className="activity-copy-grid"><div><span>AI Summary</span><p>{summary || "ยังไม่มี AI Summary"}</p></div><div><span>Action Items</span><p>{actionItems || "—"}</p></div></div>}
      {notice && <Notice variant={notice.variant}>{notice.text}</Notice>}
    </div>
  </section>;
}

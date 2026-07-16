"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice, type NoticeVariant } from "@/components/notice";

type Option = { id: string; name: string };
type Transition = { code: string; label: string };

async function command(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? "ดำเนินการไม่สำเร็จ");
}

export function ActivityWorkflowControls({ activityId, version, canAssign, assignees, transitions }: { activityId: string; version: number; canAssign: boolean; assignees: Option[]; transitions: Transition[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<"assign" | "status" | null>(null);
  const [notice, setNotice] = useState<{ text: string; variant: NoticeVariant } | null>(null);
  return <div className="grid-2" data-testid="activity-workflow-controls">
    {canAssign && <form className="card" onSubmit={async (event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget); setPending("assign"); setNotice(null);
      try { await command(`/api/v1/activities/${activityId}/assign`, { expectedVersion: version, ownerId: form.get("ownerId"), reason: form.get("reason") }); setNotice({ text: "มอบหมาย Activity เรียบร้อย", variant: "success" }); router.refresh(); }
      catch (error) { setNotice({ text: error instanceof Error ? error.message : "มอบหมายไม่สำเร็จ", variant: "error" }); }
      finally { setPending(null); }
    }}><div className="card-header"><strong>Activity Assignment</strong></div><div className="card-body form-grid">
      <label className="field"><span>Assignee</span><select className="control" name="ownerId" required>{assignees.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
      <label className="field full"><span>Assignment reason</span><textarea className="control" name="reason" minLength={3} required /></label>
      <div className="field full"><button className="primary" disabled={pending !== null}>{pending === "assign" ? "กำลังมอบหมาย…" : "ยืนยันการมอบหมาย"}</button></div>
    </div></form>}
    {transitions.length > 0 && <form className="card" onSubmit={async (event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget); setPending("status"); setNotice(null);
      try { await command(`/api/v1/activities/${activityId}/status`, { expectedVersion: version, toStatusCode: form.get("toStatusCode"), reason: form.get("reason"), outcome: form.get("outcome") }); setNotice({ text: "อัปเดตสถานะ Activity เรียบร้อย", variant: "success" }); router.refresh(); }
      catch (error) { setNotice({ text: error instanceof Error ? error.message : "อัปเดตสถานะไม่สำเร็จ", variant: "error" }); }
      finally { setPending(null); }
    }}><div className="card-header"><strong>Activity Completion</strong></div><div className="card-body form-grid">
      <label className="field"><span>Next status</span><select className="control" name="toStatusCode" data-testid="activity-next-status">{transitions.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
      <label className="field full"><span>Reason</span><textarea className="control" name="reason" minLength={3} required /></label>
      <label className="field full"><span>Completion outcome</span><textarea className="control" name="outcome" /></label>
      <div className="field full"><button className="primary" data-testid="activity-status-submit" disabled={pending !== null}>{pending === "status" ? "กำลังอัปเดต…" : "ยืนยันสถานะ"}</button></div>
    </div></form>}
    {notice && <Notice variant={notice.variant}>{notice.text}</Notice>}
  </div>;
}

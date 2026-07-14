"use client";

import { LoaderCircle, Save, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Notice } from "@/components/notice";
import { ACTIVITY_TYPES } from "@/lib/constants";

type Option = { id: string; name: string };
type ActivityValue = { id: string; version: number; subject: string; type: string; dueAt: string; notes: string; customerId: string; opportunityId: string };

async function mutation(path: string, method: "PATCH" | "DELETE", body: object) {
  const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error?.message ?? "ดำเนินการไม่สำเร็จ"); return result.data;
}

export function ActivityEditForm({ value, customers, opportunities }: { value: ActivityValue; customers: Option[]; opportunities: Option[] }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
  return <form className="card form-card activity-editor" onSubmit={async (event) => {
    event.preventDefault(); setPending(true); setMessage(""); const data = new FormData(event.currentTarget);
    try { await mutation(`/api/v1/activities/${value.id}`, "PATCH", { expectedVersion: value.version, subject: data.get("subject"), type: data.get("type"), dueAt: data.get("dueAt") ? new Date(String(data.get("dueAt"))).toISOString() : null, notes: data.get("notes") || null, customerId: data.get("customerId") || null, opportunityId: data.get("opportunityId") || null }); router.push(`/activities/${value.id}`); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"); setPending(false); }
  }}><div className="card-body"><div className="form-section"><h2>ข้อมูล Activity</h2><p className="help">แก้ไขรายละเอียดการทำงาน โดย AI Summary และหลักฐานการยืนยันเดิมจะไม่ถูกเขียนทับ</p><div className="form-grid">
    <label className="field"><span>หัวข้อ <span className="required">*</span></span><input className="control" name="subject" defaultValue={value.subject} minLength={2} maxLength={255} required autoFocus /></label>
    <label className="field"><span>ประเภท <span className="required">*</span></span><select className="control" name="type" defaultValue={value.type}>{ACTIVITY_TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label className="field"><span>กำหนดเวลา</span><input className="control" type="datetime-local" name="dueAt" defaultValue={value.dueAt} /></label>
    <label className="field"><span>ลูกค้า</span><select className="control" name="customerId" defaultValue={value.customerId}><option value="">ไม่ระบุ</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="field full"><span>Opportunity</span><select className="control" name="opportunityId" defaultValue={value.opportunityId}><option value="">ไม่ระบุ</option>{opportunities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="field full"><span>รายละเอียด / บันทึก</span><textarea className="control" name="notes" defaultValue={value.notes} maxLength={20000} rows={7} /></label>
  </div></div>{message && <Notice variant="error">{message}</Notice>}<div className="actions"><button className="secondary" type="button" onClick={() => router.back()}>ยกเลิก</button><button className="primary" disabled={pending}>{pending ? <><LoaderCircle className="spin" aria-hidden="true" />กำลังบันทึก…</> : <><Save aria-hidden="true" />บันทึกการแก้ไข</>}</button></div></div></form>;
}

export function ActivityDeleteButton({ id, version }: { id: string; version: number }) {
  const router = useRouter(); const dialog = useRef<HTMLDialogElement>(null); const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
  return <><button className="danger-secondary" type="button" onClick={() => dialog.current?.showModal()}><Trash2 aria-hidden="true" />ลบ Activity</button><dialog className="confirm-dialog" ref={dialog} aria-labelledby="delete-activity-title"><form method="dialog" onSubmit={async (event) => {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null; if (submitter?.value !== "delete") return;
    event.preventDefault(); const form = new FormData(event.currentTarget); setPending(true); setMessage("");
    try { await mutation(`/api/v1/activities/${id}`, "DELETE", { expectedVersion: version, reason: form.get("reason") }); dialog.current?.close(); router.push("/activities"); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "ลบไม่สำเร็จ"); setPending(false); }
  }}><div className="confirm-dialog-head"><div><strong id="delete-activity-title">ยืนยันการลบ Activity</strong><small>รายการจะถูกซ่อน แต่ยังเก็บหลักฐานสำหรับ audit</small></div><button className="dialog-close" value="cancel" aria-label="ปิดหน้าต่าง"><X aria-hidden="true" /></button></div><div className="confirm-dialog-body"><label className="field"><span>เหตุผลในการลบ <span className="required">*</span></span><textarea className="control" name="reason" minLength={5} maxLength={1000} required autoFocus /></label>{message && <Notice variant="error">{message}</Notice>}</div><div className="confirm-dialog-actions"><button className="secondary" value="cancel" disabled={pending}>ยกเลิก</button><button className="danger" value="delete" disabled={pending}>{pending ? "กำลังลบ…" : "ยืนยันการลบ"}</button></div></form></dialog></>;
}

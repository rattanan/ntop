"use client";

import { FileUp, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice, type NoticeVariant } from "@/components/notice";

async function command(path: string, body: object) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? "ดำเนินการไม่สำเร็จ");
  return result.data;
}

export function ProspectDocumentUpload({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  return <form className="document-upload" onSubmit={async (event) => {
    event.preventDefault(); setPending(true); setMessage(null);
    const form = event.currentTarget; const formData = new FormData(form); const file = formData.get("file");
    if (!(file instanceof File) || !file.size) { setMessage({ type: "error", text: "กรุณาเลือกไฟล์ที่ต้องการอัปโหลด" }); setPending(false); return; }
    if (file.size > 10_000_000) { setMessage({ type: "error", text: "ไฟล์ต้องมีขนาดไม่เกิน 10 MB" }); setPending(false); return; }
    try {
      const response = await fetch(`/api/v1/prospects/${id}/documents`, { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "อัปโหลดเอกสารไม่สำเร็จ");
      setMessage({ type: "success", text: "อัปโหลดและตรวจสอบเอกสารเรียบร้อยแล้ว" }); form.reset(); router.refresh();
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "อัปโหลดเอกสารไม่สำเร็จ" }); }
    finally { setPending(false); }
  }}>
    <div className="document-upload-heading"><span><FileUp aria-hidden="true" /></span><div><strong>Upload document</strong><small>ไฟล์จะถูกตรวจสอบก่อนแสดงในรายการ</small></div></div>
    <label htmlFor="prospect-document-category">Document category <span className="required">*</span></label>
    <input className="control" id="prospect-document-category" name="category" list="document-categories" placeholder="เช่น Proposal หรือ Company profile" required minLength={2} maxLength={100} />
    <datalist id="document-categories"><option value="Company profile" /><option value="Proposal" /><option value="Requirement" /><option value="Contract" /><option value="Other" /></datalist>
    <label htmlFor="prospect-document-file">File <span className="required">*</span></label>
    <input className="control file-control" id="prospect-document-file" name="file" type="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.jpg,.jpeg,.png" aria-describedby="prospect-document-help" />
    <p className="help" id="prospect-document-help">PDF, Office, CSV, TXT, JPG หรือ PNG · สูงสุด 10 MB</p>
    <button className="primary" disabled={pending}>{pending ? <><LoaderCircle className="spin" aria-hidden="true" />กำลังตรวจสอบ...</> : <><ShieldCheck aria-hidden="true" />Upload securely</>}</button>
    {message && <p className={`form-feedback ${message.type}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}
  </form>;
}

export function ProspectActionForms({ id, version, status, owners, canAssign, canConvert, canUpdate }: { id: string; version: number; status: string; owners: Array<{ id: string; name: string }>; canAssign: boolean; canConvert: boolean; canUpdate: boolean }) {
  const router = useRouter(); const [message, setMessage] = useState<{ text: string; variant: NoticeVariant } | null>(null);
  return <div className="grid-2">
    {canUpdate && <form className="card" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await command(`/api/v1/prospects/${id}/activities`, { activityType: form.get("activityType"), subject: form.get("subject"), description: form.get("description"), activityDate: new Date().toISOString(), nextFollowUpAt: form.get("nextFollowUpAt") ? new Date(String(form.get("nextFollowUpAt"))).toISOString() : undefined }); setMessage({ text: "เพิ่ม Activity แล้ว", variant: "success" }); router.refresh(); } catch (error) { setMessage({ text: error instanceof Error ? error.message : "ผิดพลาด", variant: "error" }); } }}><div className="card-body"><h3>เพิ่ม Activity</h3><select className="control" name="activityType"><option>PHONE_CALL</option><option>EMAIL</option><option>LINE</option><option>MEETING</option><option>CUSTOMER_VISIT</option><option>FOLLOW_UP</option><option>NOTE</option></select><input className="control" name="subject" placeholder="หัวข้อ" required /><textarea className="control" name="description" placeholder="รายละเอียด" /><input className="control" type="datetime-local" name="nextFollowUpAt" /><button className="primary">บันทึก Activity</button></div></form>}
    {canAssign && <form className="card" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await command(`/api/v1/prospects/${id}/assign`, { expectedVersion: version, ownerId: form.get("ownerId"), reason: form.get("reason") }); setMessage({ text: "มอบหมาย Owner แล้ว", variant: "success" }); router.refresh(); } catch (error) { setMessage({ text: error instanceof Error ? error.message : "ผิดพลาด", variant: "error" }); } }}><div className="card-body"><h3>Assign Owner</h3><select className="control" name="ownerId">{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select><textarea className="control" name="reason" placeholder="เหตุผล" minLength={5} required /><button className="primary">Assign</button></div></form>}
    {canConvert && status === "QUALIFIED" && <form className="card" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); if (!confirm("ยืนยัน Convert Prospect เป็น Lead?")) return; try { const result = await command(`/api/v1/prospects/${id}/convert`, { expectedVersion: version, qualificationNote: form.get("qualificationNote") }); router.push(`/leads/${result.leadId}`); } catch (error) { setMessage({ text: error instanceof Error ? error.message : "ผิดพลาด", variant: "error" }); } }}><div className="card-body"><h3>Convert to Lead</h3><textarea className="control" name="qualificationNote" placeholder="Qualification note" minLength={5} required /><button className="primary">Convert to Lead</button></div></form>}
    {message && <Notice variant={message.variant}>{message.text}</Notice>}
  </div>;
}

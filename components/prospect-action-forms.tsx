"use client";

import { ArrowRight, Check, FileUp, LoaderCircle, Pencil, Plus, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Notice, type NoticeVariant } from "@/components/notice";

async function command(path: string, body: object) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? "ดำเนินการไม่สำเร็จ");
  return result.data;
}

async function contactCommand(path: string, method: "POST" | "PATCH" | "DELETE", body: object) {
  const response = await fetch(path, { method, headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? "จัดการ Contact ไม่สำเร็จ");
  return result.data;
}

export type ProspectAiInsightDraft = {
  companySummary: string;
  opportunityScore: number;
  riskScore: number;
  confidenceScore: number;
  recommendedProducts: string[];
  suggestedNextAction: string;
};

export function ProspectAiInsightActions({ id, status, canUpdate, initialDraft }: { id: string; status: string; canUpdate: boolean; initialDraft: ProspectAiInsightDraft | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [pending, setPending] = useState<"request" | "confirm" | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  if (!canUpdate) return null;
  const requestInsight = async () => {
    setPending("request"); setMessage(null);
    try {
      const response = await fetch(`/api/v1/prospects/${id}/enrich`, { method: "POST", headers: { "idempotency-key": crypto.randomUUID() } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Request AI Insight ไม่สำเร็จ");
      setDraft(result.data as ProspectAiInsightDraft);
      setMessage({ type: "success", text: "AI Insight พร้อมให้ตรวจสอบแล้ว กรุณายืนยันก่อนนำไปใช้กับ Prospect" });
      router.refresh();
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "Request AI Insight ไม่สำเร็จ" }); }
    finally { setPending(null); }
  };
  const confirmInsight = async () => {
    setPending("confirm"); setMessage(null);
    try {
      const response = await fetch(`/api/v1/prospects/${id}/enrich/confirm`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "ยืนยัน AI Insight ไม่สำเร็จ");
      setMessage({ type: "success", text: "ยืนยันและบันทึก AI Insight แล้ว" });
      setDraft(null);
      router.refresh();
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "ยืนยัน AI Insight ไม่สำเร็จ" }); }
    finally { setPending(null); }
  };
  return <div className="ai-insight-actions">
    <div className="actions ai-insight-action-buttons">
      <button className={draft || status === "READY" ? "secondary" : "primary"} type="button" disabled={pending !== null || status === "PROCESSING"} onClick={() => void requestInsight()}>{pending === "request" || status === "PROCESSING" ? <><LoaderCircle className="spin" aria-hidden="true" />กำลังวิเคราะห์…</> : <><Sparkles aria-hidden="true" />Request AI Insight</>}</button>
      {(draft || status === "READY") && <button className="primary" type="button" disabled={pending !== null} onClick={() => void confirmInsight()}>{pending === "confirm" ? <><LoaderCircle className="spin" aria-hidden="true" />กำลังยืนยัน…</> : <><Check aria-hidden="true" />ยืนยันใช้ AI Insight</>}</button>}
    </div>
    {draft && <section className="ai-draft-review" aria-label="AI Insight draft awaiting confirmation"><div className="ai-draft-review-heading"><strong>AI draft — รอการยืนยัน</strong><span className="badge ai">Human review required</span></div><p>{draft.companySummary}</p><div className="ai-draft-score-row"><span>Opportunity <strong>{draft.opportunityScore}/100</strong></span><span>Risk <strong>{draft.riskScore}/100</strong></span><span>Confidence <strong>{draft.confidenceScore}/100</strong></span></div>{draft.recommendedProducts.length > 0 && <small>แนะนำ: {draft.recommendedProducts.join(", ")}</small>}{draft.suggestedNextAction && <small>Next action: {draft.suggestedNextAction}</small>}</section>}
    {message && <p className={`form-feedback ${message.type}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}
  </div>;
}

export type ProspectContactItem = {
  id: string;
  name: string;
  position: string | null;
  department: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  lineId: string | null;
  preferredContactChannel: "PHONE" | "MOBILE" | "EMAIL" | "LINE" | "MEETING" | "OTHER" | null;
  isPrimary: boolean;
};

function optional(form: FormData, name: string) {
  const value = String(form.get(name) ?? "").trim();
  return value || undefined;
}

function contactPayload(form: FormData) {
  return {
    name: String(form.get("name") ?? "").trim(),
    position: optional(form, "position"),
    department: optional(form, "department"),
    phone: optional(form, "phone"),
    mobile: optional(form, "mobile"),
    email: optional(form, "email"),
    lineId: optional(form, "lineId"),
    preferredContactChannel: optional(form, "preferredContactChannel"),
    isPrimary: form.get("isPrimary") === "on",
  };
}

function ContactFields({ contact }: { contact?: ProspectContactItem }) {
  return <div className="prospect-contact-fields">
    <label><span>ชื่อ Contact <span className="required">*</span></span><input className="control" name="name" defaultValue={contact?.name} minLength={2} maxLength={255} required /></label>
    <label><span>ตำแหน่ง</span><input className="control" name="position" defaultValue={contact?.position ?? ""} maxLength={191} /></label>
    <label><span>ฝ่าย / แผนก</span><input className="control" name="department" defaultValue={contact?.department ?? ""} maxLength={191} /></label>
    <label><span>อีเมล</span><input className="control" name="email" type="email" defaultValue={contact?.email ?? ""} /></label>
    <label><span>มือถือ</span><input className="control" name="mobile" defaultValue={contact?.mobile ?? ""} maxLength={100} /></label>
    <label><span>โทรศัพท์</span><input className="control" name="phone" defaultValue={contact?.phone ?? ""} maxLength={100} /></label>
    <label><span>LINE ID</span><input className="control" name="lineId" defaultValue={contact?.lineId ?? ""} maxLength={191} /></label>
    <label><span>ช่องทางที่ต้องการ</span><select className="control" name="preferredContactChannel" defaultValue={contact?.preferredContactChannel ?? ""}><option value="">ไม่ระบุ</option><option value="PHONE">โทรศัพท์</option><option value="MOBILE">มือถือ</option><option value="EMAIL">อีเมล</option><option value="LINE">LINE</option><option value="MEETING">ประชุม</option><option value="OTHER">อื่น ๆ</option></select></label>
    <label className="checkbox-field prospect-contact-primary"><input type="checkbox" name="isPrimary" defaultChecked={contact?.isPrimary} /> Contact หลัก</label>
  </div>;
}

export function ProspectContactManager({ id, version, contacts, canUpdate }: { id: string; version: number; contacts: ProspectContactItem[]; canUpdate: boolean }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setPending(key); setMessage(null);
    try { await action(); setMessage({ type: "success", text: success }); setCreating(false); setEditingId(null); router.refresh(); }
    catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "จัดการ Contact ไม่สำเร็จ" }); }
    finally { setPending(null); }
  };
  return <div className="prospect-contact-manager">
    {canUpdate && <div className="prospect-contact-toolbar"><button className="secondary" type="button" onClick={() => { setCreating(value => !value); setEditingId(null); setMessage(null); }}>{creating ? <><X aria-hidden="true" />ยกเลิก</> : <><Plus aria-hidden="true" />เพิ่ม Contact</>}</button></div>}
    {creating && <form className="prospect-contact-form" onSubmit={event => { event.preventDefault(); const form = event.currentTarget; const payload = contactPayload(new FormData(form)); void run("create", () => contactCommand(`/api/v1/prospects/${id}/contacts`, "POST", { expectedVersion: version, ...payload }), "เพิ่ม Contact แล้ว"); }}>
      <ContactFields />
      <p className="help">ต้องระบุช่องทางติดต่ออย่างน้อยหนึ่งรายการ: อีเมล มือถือ โทรศัพท์ หรือ LINE ID</p>
      <button className="primary" disabled={pending !== null}>{pending === "create" ? <><LoaderCircle className="spin" aria-hidden="true" />กำลังบันทึก…</> : "บันทึก Contact"}</button>
    </form>}
    <div className="prospect-contact-list">{contacts.map(contact => <article className="prospect-contact-row" key={contact.id}>
      <div className="prospect-contact-summary"><div><strong>{contact.isPrimary ? "★ " : ""}{contact.name}</strong><p>{[contact.position, contact.department].filter(Boolean).join(" · ") || "ไม่ระบุตำแหน่ง"}</p><small>{[contact.email, contact.mobile, contact.phone, contact.lineId].filter(Boolean).join(" · ")}</small></div>{canUpdate && <div className="actions"><button className="icon-action" type="button" aria-label={`แก้ไข Contact ${contact.name}`} title="แก้ไข Contact" onClick={() => { setEditingId(value => value === contact.id ? null : contact.id); setCreating(false); setMessage(null); }}><Pencil aria-hidden="true" /></button><button className="icon-action danger" type="button" aria-label={`ลบ Contact ${contact.name}`} title="ลบ Contact" disabled={pending !== null} onClick={() => { if (!window.confirm(`ยืนยันลบ Contact ${contact.name}?`)) return; void run(`delete-${contact.id}`, () => contactCommand(`/api/v1/prospects/${id}/contacts/${contact.id}`, "DELETE", { expectedVersion: version }), "ลบ Contact แล้ว"); }}><Trash2 aria-hidden="true" /></button></div>}</div>
      {editingId === contact.id && <form className="prospect-contact-form inline" onSubmit={event => { event.preventDefault(); const payload = contactPayload(new FormData(event.currentTarget)); void run(`edit-${contact.id}`, () => contactCommand(`/api/v1/prospects/${id}/contacts/${contact.id}`, "PATCH", { expectedVersion: version, ...payload }), "แก้ไข Contact แล้ว"); }}><ContactFields contact={contact} /><p className="help">ต้องระบุช่องทางติดต่ออย่างน้อยหนึ่งรายการ</p><div className="actions"><button className="secondary" type="button" onClick={() => setEditingId(null)}>ยกเลิก</button><button className="primary" disabled={pending !== null}>{pending === `edit-${contact.id}` ? <><LoaderCircle className="spin" aria-hidden="true" />กำลังบันทึก…</> : "บันทึกการแก้ไข"}</button></div></form>}
    </article>)}{!contacts.length && <div className="empty">ยังไม่มี Contact</div>}</div>
    {message && <p className={`form-feedback ${message.type}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}
  </div>;
}

export function ProspectActivityManager({ id, canUpdate }: { id: string; canUpdate: boolean }) {
  const router = useRouter();
  const toggleButton = useRef<HTMLButtonElement>(null);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  if (!canUpdate) return null;

  const close = () => {
    setCreating(false);
    setMessage(null);
    queueMicrotask(() => toggleButton.current?.focus());
  };

  return <div className="prospect-activity-manager">
    <div className="prospect-activity-toolbar"><button ref={toggleButton} className="secondary" type="button" aria-expanded={creating} aria-controls="prospect-activity-form" onClick={() => { setCreating(value => !value); setMessage(null); }}>{creating ? <><X aria-hidden="true" />ยกเลิก</> : <><Plus aria-hidden="true" />เพิ่ม Activity</>}</button></div>
    {creating && <form id="prospect-activity-form" className="prospect-activity-form" onSubmit={async (event) => {
      event.preventDefault();
      setPending(true); setMessage(null);
      const formElement = event.currentTarget;
      const form = new FormData(formElement);
      try {
        await command(`/api/v1/prospects/${id}/activities`, {
          activityType: form.get("activityType"),
          subject: form.get("subject"),
          description: optional(form, "description"),
          activityDate: new Date().toISOString(),
          nextFollowUpAt: form.get("nextFollowUpAt") ? new Date(String(form.get("nextFollowUpAt"))).toISOString() : undefined,
        });
        formElement.reset();
        setMessage({ type: "success", text: "เพิ่ม Activity แล้ว" });
        setCreating(false);
        router.refresh();
        queueMicrotask(() => toggleButton.current?.focus());
      } catch (error) {
        setMessage({ type: "error", text: error instanceof Error ? error.message : "เพิ่ม Activity ไม่สำเร็จ" });
      } finally {
        setPending(false);
      }
    }}>
      <div className="prospect-activity-fields">
        <label><span>ประเภท Activity <span className="required">*</span></span><select className="control" name="activityType" defaultValue="PHONE_CALL" required><option value="PHONE_CALL">โทรศัพท์</option><option value="EMAIL">อีเมล</option><option value="LINE">LINE</option><option value="MEETING">ประชุม</option><option value="CUSTOMER_VISIT">เข้าพบลูกค้า</option><option value="FOLLOW_UP">ติดตามผล</option><option value="NOTE">บันทึก</option></select></label>
        <label><span>ติดตามครั้งถัดไป</span><input className="control" type="datetime-local" name="nextFollowUpAt" /></label>
        <label className="full"><span>หัวข้อ <span className="required">*</span></span><input className="control" name="subject" minLength={2} maxLength={255} required autoFocus /></label>
        <label className="full"><span>รายละเอียด</span><textarea className="control" name="description" rows={3} maxLength={10_000} /></label>
      </div>
      <div className="actions"><button className="secondary" type="button" disabled={pending} onClick={close}>ยกเลิก</button><button className="primary" disabled={pending}>{pending ? <><LoaderCircle className="spin" aria-hidden="true" />กำลังบันทึก…</> : "บันทึก Activity"}</button></div>
    </form>}
    {message && <p className={`form-feedback ${message.type}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}
  </div>;
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

type ProspectTransferSummary = { company: string; contact: string; score: number; requirement: string | null; products: string | null; estimatedValue: string | null };

export function ProspectActionForms({ id, version, status, owners, canAssign, canConvert, transferSummary }: { id: string; version: number; status: string; owners: Array<{ id: string; name: string }>; canAssign: boolean; canConvert: boolean; transferSummary: ProspectTransferSummary }) {
  const router = useRouter(); const [message, setMessage] = useState<{ text: string; variant: NoticeVariant } | null>(null);
  const [converting, setConverting] = useState(false);
  return <div className="grid-2">
    {canAssign && <form className="card" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await command(`/api/v1/prospects/${id}/assign`, { expectedVersion: version, ownerId: form.get("ownerId"), reason: form.get("reason") }); setMessage({ text: "มอบหมาย Owner แล้ว", variant: "success" }); router.refresh(); } catch (error) { setMessage({ text: error instanceof Error ? error.message : "ผิดพลาด", variant: "error" }); } }}><div className="card-body"><h3>Assign Owner</h3><select className="control" name="ownerId">{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select><label className="field-label required-label" htmlFor="prospect-assign-reason">เหตุผล</label><textarea className="control" id="prospect-assign-reason" name="reason" placeholder="เหตุผล" minLength={5} required /><button className="primary">Assign</button></div></form>}
    {canConvert && status === "QUALIFIED" && <form id="prospect-conversion" className="card conversion-panel conversion-panel-wide" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); if (!confirm("ยืนยันสร้าง Lead จากข้อมูล Prospect นี้?")) return; setConverting(true); try { const result = await command(`/api/v1/prospects/${id}/convert`, { expectedVersion: version, qualificationNote: form.get("qualificationNote") }); router.push(`/leads/${result.leadId}`); } catch (error) { setMessage({ text: error instanceof Error ? error.message : "ผิดพลาด", variant: "error" }); setConverting(false); } }}><div className="card-header conversion-panel-header"><div><strong>สร้าง Lead จาก Prospect</strong><small>ตรวจสอบข้อมูลที่จะนำไปใช้ต่อก่อนยืนยัน</small></div><span className="badge success">พร้อมสร้าง</span></div><div className="card-body"><div className="conversion-flow" aria-label="ลำดับการแปลงข้อมูล"><span>Prospect</span><ArrowRight aria-hidden="true"/><strong>Lead</strong></div><div className="conversion-summary-grid">
      <div><span><Check aria-hidden="true"/>บริษัท</span><strong>{transferSummary.company}</strong></div><div><span><Check aria-hidden="true"/>ผู้ติดต่อหลัก</span><strong>{transferSummary.contact}</strong></div><div><span><Check aria-hidden="true"/>Lead score</span><strong>{transferSummary.score}/100</strong></div><div><span><Check aria-hidden="true"/>มูลค่าประมาณการ</span><strong>{transferSummary.estimatedValue ? `${transferSummary.estimatedValue} บาท` : "ยังไม่ระบุ"}</strong></div><div className="conversion-summary-wide"><span><Check aria-hidden="true"/>ความต้องการ</span><strong>{transferSummary.requirement ?? "ยังไม่ระบุ"}</strong></div><div className="conversion-summary-wide"><span><Check aria-hidden="true"/>สินค้า/บริการ</span><strong>{transferSummary.products ?? "ยังไม่ระบุ"}</strong></div>
    </div><p className="conversion-retention-note">Prospect เดิมและประวัติยังคงอยู่ พร้อมลิงก์ย้อนกลับจาก Lead</p><label className="field-label required-label" htmlFor="prospect-qualification-note">บันทึกเหตุผลการสร้าง Lead</label><textarea className="control" id="prospect-qualification-note" name="qualificationNote" placeholder="เช่น ยืนยันความต้องการและงบประมาณกับผู้ติดต่อแล้ว" minLength={5} required /><div className="actions"><button className="primary" disabled={converting}>{converting ? <><LoaderCircle className="spin" aria-hidden="true"/>กำลังสร้าง Lead…</> : <>ยืนยันและเปิด Lead<ArrowRight aria-hidden="true"/></>}</button></div></div></form>}
    {message && <Notice variant={message.variant}>{message.text}</Notice>}
  </div>;
}

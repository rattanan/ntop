"use client";

import { ArrowRight, LoaderCircle, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type RefObject } from "react";

import { FormField, Input, Textarea } from "@/components/form-field";
import { Notice } from "@/components/notice";

type OwnerOption = {
  userId: string;
  name: string;
  organizationUnitId: string;
  organizationUnitName: string;
  organizationUnitCode: string;
};

async function post(path: string, body: object) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? "ดำเนินการไม่สำเร็จ");
  return result.data;
}

function closeDialog(dialog: RefObject<HTMLDialogElement | null>, trigger: RefObject<HTMLButtonElement | null>) {
  dialog.current?.close();
  queueMicrotask(() => trigger.current?.focus());
}

export function ProspectOwnerAction({ id, version, ownerName, owners }: { id: string; version: number; ownerName: string; owners: OwnerOption[] }) {
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  return <>
    <span className="prospect-owner-inline">
      Owner: {ownerName}
      <button ref={trigger} className="owner-edit-button" type="button" aria-label="Assign Owner" title="Assign Owner" onClick={() => { setMessage(""); dialog.current?.showModal(); }}><Pencil aria-hidden="true" /></button>
    </span>
    <dialog ref={dialog} className="confirm-dialog" aria-labelledby="assign-owner-title" onCancel={(event) => { event.preventDefault(); closeDialog(dialog, trigger); }}>
      <form onSubmit={async (event) => {
        event.preventDefault(); setPending(true); setMessage("");
        const form = new FormData(event.currentTarget);
        try {
          const target = JSON.parse(String(form.get("ownerAssignment"))) as { ownerId: string; organizationUnitId: string };
          const result = await post(`/api/v1/prospects/${id}/assign`, { expectedVersion: version, ...target, reason: form.get("reason") });
          closeDialog(dialog, trigger);
          if (result.accessRetained === false) { router.replace("/prospects?notice=owner-assigned"); return; }
          router.refresh();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Assign Owner ไม่สำเร็จ");
          setPending(false);
        }
      }}>
        <div className="confirm-dialog-head"><div><strong id="assign-owner-title">Assign Owner</strong><small>เปลี่ยนผู้รับผิดชอบพร้อมบันทึกประวัติและเหตุผล</small></div><button className="icon-action" type="button" aria-label="ปิด" onClick={() => closeDialog(dialog, trigger)}><X aria-hidden="true" /></button></div>
        <div className="confirm-dialog-body form-grid single-column">
          <FormField label="ผู้รับผิดชอบและหน่วยงานใหม่" name="ownerAssignment" required><select className="control" id="ownerAssignment" name="ownerAssignment" defaultValue="" required><option value="" disabled>เลือกผู้รับผิดชอบ</option>{owners.map((owner) => <option key={`${owner.userId}:${owner.organizationUnitId}`} value={JSON.stringify({ ownerId: owner.userId, organizationUnitId: owner.organizationUnitId })}>{owner.name} — {owner.organizationUnitName} ({owner.organizationUnitCode})</option>)}</select></FormField>
          <FormField label="เหตุผล" name="reason" required><Textarea id="reason" name="reason" minLength={5} required placeholder="เช่น ปรับผู้รับผิดชอบตามเขตการขาย" /></FormField>
          {!owners.length && <Notice variant="warning">ไม่พบผู้ใช้ที่มี active assignment ในขอบเขตหน่วยงานที่คุณดูแล</Notice>}
          {message && <Notice variant="error">{message}</Notice>}
        </div>
        <div className="confirm-dialog-actions"><button className="secondary" type="button" disabled={pending} onClick={() => closeDialog(dialog, trigger)}>ยกเลิก</button><button className="primary" disabled={pending || !owners.length}>{pending ? <><LoaderCircle className="spin" aria-hidden="true" />กำลังบันทึก…</> : "Assign Owner"}</button></div>
      </form>
    </dialog>
  </>;
}

export function ProspectConvertAction({ id, version, hasContact, contactName }: { id: string; version: number; hasContact: boolean; contactName?: string }) {
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  return <>
    <button ref={trigger} className="primary" type="button" onClick={() => { setMessage(""); dialog.current?.showModal(); }}>Convert to Lead<ArrowRight aria-hidden="true" /></button>
    <dialog ref={dialog} className="confirm-dialog prospect-convert-dialog" aria-labelledby="convert-lead-title" onCancel={(event) => { event.preventDefault(); closeDialog(dialog, trigger); }}>
      <form onSubmit={async (event) => {
        event.preventDefault(); setPending(true); setMessage("");
        const form = new FormData(event.currentTarget);
        let currentVersion = version;
        try {
          if (!hasContact) {
            const name = String(form.get("contactName") ?? "").trim();
            const email = String(form.get("contactEmail") ?? "").trim();
            const mobile = String(form.get("contactMobile") ?? "").trim();
            const phone = String(form.get("contactPhone") ?? "").trim();
            const lineId = String(form.get("contactLineId") ?? "").trim();
            if (name.length < 2 || ![email, mobile, phone, lineId].some(Boolean)) {
              setMessage("ยังสร้าง Lead ไม่ได้: กรุณาระบุชื่อ Contact และช่องทางติดต่ออย่างน้อยหนึ่งรายการ ข้อมูลที่กรอกไว้จะยังคงอยู่");
              setPending(false); return;
            }
            const contact = await post(`/api/v1/prospects/${id}/contacts`, { expectedVersion: currentVersion, name, email, mobile, phone, lineId, isPrimary: true });
            currentVersion = Number(contact.version);
          }
          const qualificationNote = String(form.get("qualificationNote") ?? "").trim();
          if (qualificationNote.length < 5) { setMessage("กรุณาระบุเหตุผลการ Convert อย่างน้อย 5 ตัวอักษร"); setPending(false); return; }
          const result = await post(`/api/v1/prospects/${id}/convert`, { expectedVersion: currentVersion, qualificationNote });
          router.push(`/leads/${result.leadId}`);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Convert to Lead ไม่สำเร็จ");
          setPending(false);
        }
      }}>
        <div className="confirm-dialog-head"><div><strong id="convert-lead-title">Convert Prospect to Lead</strong><small>ระบบจะดึงข้อมูลบริษัท ความต้องการ งบประมาณ และ Owner ไปสร้าง Lead</small></div><button className="icon-action" type="button" aria-label="ปิด" onClick={() => closeDialog(dialog, trigger)}><X aria-hidden="true" /></button></div>
        <div className="confirm-dialog-body">
          <Notice variant={hasContact ? "info" : "warning"}>{hasContact ? `จะใช้ Contact หลัก: ${contactName}` : "Prospect นี้ยังไม่มี Contact กรุณากรอกข้อมูลด้านล่างก่อน Convert"}</Notice>
          {!hasContact && <div className="form-grid"><FormField label="ชื่อ Contact" name="contactName" required><Input name="contactName" minLength={2} required autoFocus /></FormField><FormField label="อีเมล" name="contactEmail"><Input name="contactEmail" type="email" /></FormField><FormField label="มือถือ" name="contactMobile"><Input name="contactMobile" /></FormField><FormField label="โทรศัพท์" name="contactPhone"><Input name="contactPhone" /></FormField><FormField label="LINE ID" name="contactLineId"><Input name="contactLineId" /></FormField></div>}
          <FormField label="บันทึกเหตุผลการ Convert" name="qualificationNote" required><Textarea name="qualificationNote" minLength={5} required placeholder="เช่น ยืนยันความต้องการและงบประมาณกับผู้ติดต่อแล้ว" /></FormField>
          {message && <Notice variant="error">{message}</Notice>}
        </div>
        <div className="confirm-dialog-actions"><button className="secondary" type="button" disabled={pending} onClick={() => closeDialog(dialog, trigger)}>ยกเลิก</button><button className="primary" disabled={pending}>{pending ? <><LoaderCircle className="spin" aria-hidden="true" />กำลังสร้าง Lead…</> : <>ยืนยัน Convert<ArrowRight aria-hidden="true" /></>}</button></div>
      </form>
    </dialog>
  </>;
}

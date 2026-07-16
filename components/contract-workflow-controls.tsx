"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Notice, type NoticeVariant } from "@/components/notice";

type TransitionOption = { code: string; label: string };
type DocumentOption = { id: string; label: string };

async function payload(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? "ดำเนินการไม่สำเร็จ");
  return result.data;
}

export function ContractWorkflowControls({ contractId, version, transitions, canUploadDocument, canSign, documents }: { contractId: string; version: number; transitions: TransitionOption[]; canUploadDocument: boolean; canSign: boolean; documents: DocumentOption[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<"transition" | "document" | "signature" | null>(null);
  const [message, setMessage] = useState<{ text: string; variant: NoticeVariant } | null>(null);

  return <div className="grid-2" data-testid="contract-workflow-controls">
    {transitions.length > 0 && <form className="card" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const target = String(form.get("toStatusCode") ?? "");
      if (!window.confirm(`ยืนยันเปลี่ยนสถานะ Contract เป็น ${target}?`)) return;
      setPending("transition"); setMessage(null);
      try {
        await payload(await fetch(`/api/v1/contracts/${contractId}/status`, {
          method: "POST",
          headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
          body: JSON.stringify({ expectedVersion: version, toStatusCode: target, comment: form.get("comment") }),
        }));
        setMessage({ text: "เปลี่ยนสถานะ Contract เรียบร้อย", variant: "success" });
        router.refresh();
      } catch (error) {
        setMessage({ text: error instanceof Error ? error.message : "เปลี่ยนสถานะไม่สำเร็จ", variant: "error" });
      } finally { setPending(null); }
    }}><div className="card-header"><strong>Contract Workflow</strong></div><div className="card-body form-grid">
      <label className="field"><span>Next status</span><select className="control" name="toStatusCode" data-testid="contract-next-status">{transitions.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
      <label className="field full"><span>Comment / reason</span><textarea className="control" name="comment" minLength={3} required /></label>
      <div className="field full"><button className="primary" data-testid="contract-transition-submit" disabled={pending !== null}>{pending === "transition" ? "กำลังเปลี่ยนสถานะ…" : "ยืนยัน Transition"}</button></div>
    </div></form>}

    {canUploadDocument && <form className="card" onSubmit={async (event) => {
      event.preventDefault();
      setPending("document"); setMessage(null);
      const form = event.currentTarget;
      try {
        await payload(await fetch(`/api/v1/contracts/${contractId}/documents`, {
          method: "POST",
          headers: { "idempotency-key": crypto.randomUUID() },
          body: new FormData(form),
        }));
        form.reset();
        setMessage({ text: "แนบเอกสาร Contract เรียบร้อย", variant: "success" });
        router.refresh();
      } catch (error) {
        setMessage({ text: error instanceof Error ? error.message : "แนบเอกสารไม่สำเร็จ", variant: "error" });
      } finally { setPending(null); }
    }}><div className="card-header"><strong>Contract Document</strong></div><div className="card-body form-grid">
      <label className="field"><span>Category</span><input className="control" name="category" defaultValue="CONTRACT" minLength={2} required /></label>
      <label className="field full"><span>File</span><input className="control" name="file" type="file" required /></label>
      <div className="field full"><button className="secondary" data-testid="contract-document-submit" disabled={pending !== null}>{pending === "document" ? "กำลังอัปโหลด…" : "แนบเอกสาร"}</button></div>
    </div></form>}
    {canSign && documents.length > 0 && <form className="card" onSubmit={async (event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget); setPending("signature"); setMessage(null);
      try {
        await payload(await fetch(`/api/v1/contracts/${contractId}/signatures`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ expectedVersion: version, partyCode: form.get("partyCode"), documentVersionId: form.get("documentVersionId"), signedByName: form.get("signedByName"), signedAt: new Date(String(form.get("signedAt"))).toISOString() }) }));
        setMessage({ text: "บันทึกหลักฐานลายเซ็นเรียบร้อย", variant: "success" }); router.refresh();
      } catch (error) { setMessage({ text: error instanceof Error ? error.message : "บันทึกลายเซ็นไม่สำเร็จ", variant: "error" }); }
      finally { setPending(null); }
    }}><div className="card-header"><strong>Verified Signature Evidence</strong></div><div className="card-body form-grid">
      <label className="field"><span>Signing party</span><select className="control" name="partyCode"><option value="CUSTOMER">Customer</option><option value="NT">NT</option></select></label>
      <label className="field"><span>Clean document</span><select className="control" name="documentVersionId">{documents.map((document) => <option key={document.id} value={document.id}>{document.label}</option>)}</select></label>
      <label className="field"><span>Signed by</span><input className="control" name="signedByName" minLength={2} required /></label>
      <label className="field"><span>Signed at</span><input className="control" name="signedAt" type="datetime-local" required /></label>
      <div className="field full"><button className="primary" data-testid="contract-signature-submit" disabled={pending !== null}>{pending === "signature" ? "กำลังบันทึก…" : "บันทึกลายเซ็น"}</button></div>
    </div></form>}
    {message && <Notice variant={message.variant}>{message.text}</Notice>}
  </div>;
}

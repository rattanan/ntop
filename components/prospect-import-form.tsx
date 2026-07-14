"use client";

import Link from "next/link";
import { useState } from "react";
import { Notice, type NoticeVariant } from "@/components/notice";

type ImportMessage = { text: string; variant: NoticeVariant };

export function ProspectImportForm() {
  const [batchId, setBatchId] = useState("");
  const [message, setMessage] = useState<ImportMessage | null>(null);
  const [key] = useState(() => crypto.randomUUID());

  return <section className="card">
    <form className="card-body actions" onSubmit={async event => {
      event.preventDefault();
      const file = new FormData(event.currentTarget).get("file");
      if (!(file instanceof File)) return;
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/v1/prospects/import/preview", { method: "POST", headers: { "idempotency-key": key }, body: form });
      const result = await response.json();
      if (response.ok) {
        setBatchId(result.data.batchId);
        setMessage({ text: `ทั้งหมด ${result.data.total} · ผ่าน ${result.data.valid} · ผิดพลาด ${result.data.error}`, variant: result.data.error ? "warning" : "info" });
      } else {
        setMessage({ text: result.error?.message ?? "Preview ไม่สำเร็จ", variant: "error" });
      }
    }}>
      <label>Import CSV/XLSX <input type="file" name="file" accept=".csv,.xlsx" required/></label>
      <button className="secondary">Preview</button>
      <Link className="link" href="/api/v1/prospects/import/template">Template</Link>
    </form>
    {batchId&&<div className="card-body">
      {message&&<Notice variant={message.variant}>{message.text}</Notice>}
      <button className="primary" onClick={async()=>{
        const response=await fetch("/api/v1/prospects/import",{method:"POST",headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},body:JSON.stringify({batchId})});
        const result=await response.json();
        if (response.ok||response.status===207) {
          setMessage({ text: `Imported ${result.data.imported} · Failed ${result.data.failed}`, variant: result.data.failed ? "warning" : "success" });
        } else {
          setMessage({ text: result.error?.message ?? "Import ไม่สำเร็จ", variant: "error" });
        }
      }}>Confirm Import</button>
    </div>}
    {message&&!batchId&&<Notice variant={message.variant}>{message.text}</Notice>}
  </section>;
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { Notice, type NoticeVariant } from "./notice";

type Preview = { total: number; valid: number; invalid: number; duplicates: number };

export function LeadImportForm() {
  const [message, setMessage] = useState<{ text: string; variant: NoticeVariant } | null>(null);
  const [pending, setPending] = useState(false);
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const request = (path: string, body: string) => fetch(path, { method: "POST", headers: { "content-type": "text/csv; charset=utf-8", "idempotency-key": crypto.randomUUID() }, body });

  return <section className="card">
    <form onSubmit={async event => {
      event.preventDefault();
      const file = new FormData(event.currentTarget).get("file");
      if (!(file instanceof File)) return;
      setPending(true); setMessage(null);
      try {
        const body = await file.text();
        const response = await request("/api/v1/leads/import/preview", body);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message);
        setContent(body); setPreview(result.data); setMessage({ text: "ตรวจสอบไฟล์แล้ว กรุณายืนยันการนำเข้า", variant: "warning" });
      } catch (error) { setMessage({ text: error instanceof Error ? error.message : "ตรวจสอบไฟล์ไม่สำเร็จ", variant: "error" }); }
      finally { setPending(false); }
    }}>
      <div className="card-body actions"><label>นำเข้า CSV <input type="file" name="file" accept=".csv,text/csv" required/></label><button className="secondary" disabled={pending}>{pending ? "กำลังตรวจสอบ…" : "Preview"}</button><Link className="link" href="/api/v1/leads/import/template">ดาวน์โหลด Template</Link></div>
    </form>
    {preview && <div className="card-body"><p>ทั้งหมด {preview.total} · ผ่าน {preview.valid} · ผิดพลาด {preview.invalid} · อาจซ้ำ {preview.duplicates}</p><button className="primary" disabled={pending || preview.valid === 0} onClick={async () => {
      setPending(true);
      try {
        const response = await request("/api/v1/leads/import", content);
        const result = await response.json();
        setMessage(response.ok || response.status === 207 ? { text: `สร้าง ${result.data.created} · ผิดพลาด ${result.data.failed}`, variant: result.data.failed ? "warning" : "success" } : { text: result.error?.message ?? "นำเข้าไม่สำเร็จ", variant: "error" });
      } catch (error) { setMessage({ text: error instanceof Error ? error.message : "นำเข้าไม่สำเร็จ", variant: "error" }); }
      finally { setPending(false); }
    }}>ยืนยันนำเข้าแถวที่ผ่าน</button></div>}
    {message && <Notice variant={message.variant}>{message.text}</Notice>}
  </section>;
}

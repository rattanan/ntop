"use client";

import { Download, LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ContractDocumentActions({ contractId, documentId, fileName, canDelete }: { contractId: string; documentId: string; fileName: string; canDelete: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return <div className="document-row-actions">
    <a className="icon-action" href={`/api/v1/contracts/${contractId}/documents/${documentId}`} aria-label={`ดาวน์โหลดเอกสาร ${fileName}`} title="ดาวน์โหลดเอกสาร"><Download aria-hidden="true" /></a>
    {canDelete && <button className="icon-action" type="button" aria-label={`ลบเอกสาร ${fileName}`} title="ย้ายเอกสารไปถังขยะ" disabled={pending} onClick={async () => {
      if (!window.confirm(`ยืนยันย้ายเอกสาร ${fileName} ไปถังขยะ?`)) return;
      setPending(true); setError(null);
      try {
        const response = await fetch(`/api/v1/contracts/${contractId}/documents/${documentId}`, { method: "DELETE", headers: { "idempotency-key": crypto.randomUUID() } });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message ?? "ลบเอกสารไม่สำเร็จ");
        router.refresh();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "ลบเอกสารไม่สำเร็จ");
      } finally { setPending(false); }
    }}>{pending ? <LoaderCircle className="spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}</button>}
    {error && <span className="form-feedback error" role="alert">{error}</span>}
  </div>;
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const columnOptions = [["lead", "Lead / บริษัท"], ["source", "แหล่งที่มา"], ["status", "สถานะ"], ["score", "Score"], ["followUp", "ติดตาม"], ["owner", "ผู้รับผิดชอบ"], ["actions", "การทำงาน"]] as const;
type SavedView = { id: string; name: string; query: Record<string, string>; columns: string[]; isDefault: boolean };

export function LeadSavedViewControls({ query, columns, savedViews }: { query: Record<string, string>; columns: string[]; savedViews: SavedView[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const viewHref = (view: SavedView) => `/leads?${new URLSearchParams({ ...view.query, columns: view.columns.join(",") })}`;
  return <section className="card"><div className="card-body">
    <div className="actions"><strong>Saved Views</strong>{savedViews.map(view => <span key={view.id}><Link className="secondary" href={viewHref(view)}>{view.isDefault ? "★ " : ""}{view.name}</Link><button type="button" aria-label={`ลบ ${view.name}`} onClick={async () => { if (!window.confirm(`ลบ Saved View “${view.name}” หรือไม่`)) return; await fetch(`/api/v1/leads/views/${view.id}`, { method: "DELETE" }); router.refresh(); }}>×</button></span>)}</div>
    <div className="form-grid"><label className="field"><span>ชื่อ View</span><input className="control" value={name} maxLength={100} onChange={event => setName(event.target.value)} placeholder="เช่น Hot Lead ของทีม"/></label><fieldset className="field"><legend>คอลัมน์ที่แสดง</legend>{columnOptions.map(([value, label]) => <label key={value}><input type="checkbox" checked={columns.includes(value)} onChange={() => { const next = columns.includes(value) ? columns.filter(item => item !== value) : [...columns, value]; const parameters = new URLSearchParams(query); parameters.set("columns", next.join(",")); router.push(`/leads?${parameters}`); }}/>{label}</label>)}</fieldset></div>
    <div className="actions"><label><input type="checkbox" checked={isDefault} onChange={event => setIsDefault(event.target.checked)}/> ตั้งเป็นค่าเริ่มต้น</label><button type="button" className="secondary" disabled={pending || name.trim().length < 2 || columns.length === 0} onClick={async () => { setPending(true); setMessage(""); try { const response = await fetch("/api/v1/leads/views", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, query, columns, isDefault }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error?.message); setName(""); setIsDefault(false); setMessage("บันทึก Saved View แล้ว"); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"); } finally { setPending(false); } }}>{pending ? "กำลังบันทึก…" : "บันทึก View ปัจจุบัน"}</button></div>
    {message && <p>{message}</p>}
  </div></section>;
}

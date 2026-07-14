"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Rule = { id: string; name: string; priority: number; active: boolean; strategy: "OWNER" | "ROUND_ROBIN"; criteria: Record<string, string>; targetOwnerId: string | null; organizationUnitId: string | null };
type Option = { id: string; name: string };

export function LeadAssignmentRuleConsole({ rules, users, organizationUnits }: { rules: Rule[]; users: Option[]; organizationUnits: Option[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const submit = async (payload: object) => {
    const response = await fetch("/api/v1/leads/assignment-rules", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message ?? "บันทึกไม่สำเร็จ");
    router.refresh();
  };
  return <div className="grid-2">
    <form className="card form-card" onSubmit={async event => {
      event.preventDefault(); setMessage("");
      const data = new FormData(event.currentTarget), strategy = String(data.get("strategy"));
      try {
        await submit({ name: data.get("name"), priority: Number(data.get("priority")), active: true, strategy, criteria: { ...(data.get("source") ? { source: data.get("source") } : {}), ...(data.get("companyContains") ? { companyContains: data.get("companyContains") } : {}), ...(data.get("productContains") ? { productContains: data.get("productContains") } : {}) }, targetOwnerId: strategy === "OWNER" ? data.get("targetOwnerId") : null, organizationUnitId: data.get("organizationUnitId") || null });
        event.currentTarget.reset(); setMessage("สร้าง Assignment Rule แล้ว");
      } catch (error) { setMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"); }
    }}><div className="card-body"><h2>สร้าง Assignment Rule</h2><input className="control" name="name" placeholder="ชื่อกฎ" required minLength={2}/><input className="control" name="priority" type="number" defaultValue={100} min={0} max={10000} required/><select className="control" name="strategy"><option value="OWNER">กำหนด Owner</option><option value="ROUND_ROBIN">Round-robin ตามหน่วยงาน</option></select><input className="control" name="source" placeholder="Source (เว้นว่าง = ทุก source)"/><input className="control" name="companyContains" placeholder="ชื่อบริษัทมีคำว่า…"/><input className="control" name="productContains" placeholder="สินค้าที่สนใจมีคำว่า…"/><select className="control" name="targetOwnerId"><option value="">เลือก Owner เมื่อใช้ OWNER</option>{users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select><select className="control" name="organizationUnitId"><option value="">เลือกหน่วยงาน</option>{organizationUnits.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select><button className="primary">สร้างกฎ</button>{message && <p>{message}</p>}</div></form>
    <section className="card"><div className="card-header">กฎปัจจุบัน</div><div className="card-body">{rules.map(rule => <div className="relationship" key={rule.id}><div><strong>{rule.priority} · {rule.name}</strong><p>{rule.strategy} · {Object.entries(rule.criteria).map(([key, value]) => `${key}=${value}`).join(", ") || "ทุก Lead"}</p></div><button className="secondary" type="button" onClick={async () => { try { await submit({ id: rule.id, name: rule.name, priority: rule.priority, active: !rule.active, strategy: rule.strategy, criteria: rule.criteria, targetOwnerId: rule.targetOwnerId, organizationUnitId: rule.organizationUnitId }); } catch (error) { setMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"); } }}>{rule.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}</button></div>)}{!rules.length && <div className="empty">ยังไม่มี Assignment Rule — Lead จะถูกมอบหมายให้ผู้สร้างตามพฤติกรรมเดิม</div>}</div></section>
  </div>;
}

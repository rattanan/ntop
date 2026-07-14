import { LoginOutcome } from "@prisma/client";
import Link from "next/link";

import { requirePermission } from "@/lib/authorization/require-permission";
import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import { prisma } from "@/lib/prisma";

const time = (value: Date) => value.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "medium" });

export default async function AuditAdministrationPage() {
  await requirePermission(PERMISSIONS.auditRead);
  const [loginEvents, auditEvents] = await Promise.all([
    prisma.loginEvent.findMany({ take: 200, orderBy: { occurredAt: "desc" }, include: { user: { select: { name: true, email: true } } } }),
    prisma.auditEvent.findMany({ take: 200, orderBy: { sequence: "desc" }, select: { sequence: true, actorId: true, action: true, targetType: true, targetId: true, outcome: true, correlationId: true, recordedAt: true } }),
  ]);
  const actorIds = [...new Set(auditEvents.map(event => event.actorId).filter(id => id !== "anonymous"))];
  const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } }) : [];
  const actorMap = new Map(actors.map(actor => [actor.id, `${actor.name} (${actor.email})`]));
  const failedLogins = loginEvents.filter(event => event.outcome !== LoginOutcome.SUCCESS).length;

  return <><div className="page-head"><div><p className="eyebrow">Security Monitoring</p><h1>Login History & Audit Log</h1><p>แสดงสูงสุด 200 รายการล่าสุด เวลา Asia/Bangkok และไม่เปิดเผย identifier หรือ network fingerprint ดิบ</p></div><Link className="secondary" href="/admin/users">กลับ Users & Roles</Link></div>
    <div className="stats"><section className="card stat"><p>Login events</p><strong>{loginEvents.length}</strong></section><section className="card stat"><p>Login ไม่สำเร็จ</p><strong>{failedLogins}</strong></section><section className="card stat"><p>Audit events</p><strong>{auditEvents.length}</strong></section></div>
    <div className="lead-workflow-stack">
      <section className="card"><div className="card-body"><h2>Login history</h2><p className="help">บัญชีที่ไม่รู้จักจะแสดงโดยไม่เปิดเผยอีเมล, IP หรือ User-Agent</p></div><div className="table-wrap"><table className="table"><thead><tr><th>เวลา</th><th>ผู้ใช้งาน</th><th>ผลลัพธ์</th><th>Correlation ID</th></tr></thead><tbody>{loginEvents.map(event=><tr key={event.id}><td>{time(event.occurredAt)}</td><td>{event.user ? <><strong>{event.user.name}</strong><br/><small>{event.user.email}</small></> : "บัญชีที่ไม่รู้จัก"}</td><td><span className={`badge ${event.outcome===LoginOutcome.SUCCESS?"success":"muted"}`}>{event.outcome}</span></td><td><small>{event.correlationId}</small></td></tr>)}</tbody></table>{!loginEvents.length&&<div className="empty">ยังไม่มีประวัติ Login</div>}</div></section>
      <section className="card"><div className="card-body"><h2>Audit log</h2><p className="help">บันทึกแบบ hash chain และเรียงตาม sequence ล่าสุด</p></div><div className="table-wrap"><table className="table"><thead><tr><th>Sequence / เวลา</th><th>ผู้ดำเนินการ</th><th>Action</th><th>Target</th><th>ผลลัพธ์</th><th>Correlation ID</th></tr></thead><tbody>{auditEvents.map(event=><tr key={event.sequence.toString()}><td>#{event.sequence.toString()}<br/><small>{time(event.recordedAt)}</small></td><td>{event.actorId==="anonymous"?"Anonymous":actorMap.get(event.actorId)??event.actorId}</td><td>{event.action}</td><td>{event.targetType}<br/><small>{event.targetId}</small></td><td><span className={`badge ${event.outcome==="SUCCESS"?"success":"muted"}`}>{event.outcome}</span></td><td><small>{event.correlationId}</small></td></tr>)}</tbody></table>{!auditEvents.length&&<div className="empty">ยังไม่มี Audit event</div>}</div></section>
    </div>
  </>;
}

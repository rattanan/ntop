import { Eye, Pencil } from "lucide-react";
import Link from "next/link";

import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { buildActivityScopeWhere } from "@/lib/activity/activity-authorization";
import { ACTIVITY_TYPES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

const typeLabels = Object.fromEntries(ACTIVITY_TYPES);

export default async function Activities() {
  const session = await requireSession();
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const activities = await prisma.activity.findMany({ where: { deletedAt: null, ...buildActivityScopeWhere(authorization) }, include: { status: true, customer: true, opportunity: true, owner: true }, orderBy: { createdAt: "desc" } });
  const canUpdate = session.role !== "VIEWER";
  const now = new Date();
  return <><div className="page-head"><div><p className="eyebrow">Activity & Meeting</p><h1>กิจกรรมและการประชุม</h1><p>ติดตามงาน ดูรายละเอียด และอัปเดตกิจกรรมจากจุดเดียว</p></div>{canUpdate && <Link href="/activities/new" className="primary">บันทึกกิจกรรม</Link>}</div><section className="card activity-list-card"><div className="table-wrap"><table className="table activity-table"><thead><tr><th>หัวข้อ</th><th>ประเภท / สถานะ</th><th>ลูกค้า / Opportunity</th><th>กำหนดเวลา</th><th>AI Summary</th><th>ผู้รับผิดชอบ</th><th className="action-column">การทำงาน</th></tr></thead><tbody>{activities.map((activity) => { const timing = activity.status.terminal || !activity.dueAt ? null : activity.dueAt < now ? "Overdue" : "Upcoming"; return <tr key={activity.id}><td><strong>{activity.subject}</strong>{activity.actionItems && <><br /><small>Action: {activity.actionItems}</small></>}</td><td><span className="badge">{typeLabels[activity.type] ?? activity.type}</span> <span className="badge muted">{activity.status.label}</span></td><td><span className="activity-related">{activity.customer?.name || "—"}{activity.opportunity && <small>{activity.opportunity.name}</small>}</span></td><td>{activity.dueAt?.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) || "—"}{timing && <small className="table-subtext">{timing}</small>}</td><td className="activity-summary-cell">{activity.aiSummary || "—"}</td><td>{activity.owner.name}</td><td><div className="row-actions"><Link className="row-action" href={`/activities/${activity.id}`} aria-label={`ดูรายละเอียด ${activity.subject}`}><Eye aria-hidden="true" />ดู</Link>{canUpdate && <Link className="row-action" href={`/activities/${activity.id}/edit`} aria-label={`แก้ไข ${activity.subject}`}><Pencil aria-hidden="true" />แก้ไข</Link>}</div></td></tr>})}</tbody></table>{!activities.length && <div className="empty">ยังไม่มีกิจกรรม บันทึกการประชุมเพื่อสร้าง AI Summary และ Action Items</div>}</div></section></>;
}

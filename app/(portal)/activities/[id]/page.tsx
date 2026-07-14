import { ArrowLeft, CalendarClock, Pencil, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityDeleteButton } from "@/components/activity-management";
import { buildActivityScopeWhere } from "@/lib/activity/activity-authorization";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { ACTIVITY_TYPES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

const typeLabels = Object.fromEntries(ACTIVITY_TYPES);
const formatDate = (value: Date | null) => value?.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) ?? "—";

export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(); const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role }); const { id } = await params;
  const activity = await prisma.activity.findFirst({ where: { id, deletedAt: null, ...buildActivityScopeWhere(authorization) }, include: { owner: { select: { name: true } }, customer: { select: { id: true, name: true } }, opportunity: { select: { id: true, name: true, opportunityNumber: true } }, lead: { select: { id: true, leadNumber: true, company: true } }, prospect: { select: { id: true, prospectCode: true, companyName: true } } } });
  if (!activity) notFound(); const canUpdate = session.role !== "VIEWER";
  const participants = Array.isArray(activity.participants) ? activity.participants.filter((item): item is string => typeof item === "string") : [];
  return <><div className="activity-detail-head"><div><Link className="back-link" href="/activities"><ArrowLeft aria-hidden="true" />กิจกรรมทั้งหมด</Link><p className="eyebrow">{typeLabels[activity.type] ?? activity.type}</p><h1>{activity.subject}</h1><div className="activity-detail-meta"><span><CalendarClock aria-hidden="true" />{formatDate(activity.dueAt)}</span><span><UserRound aria-hidden="true" />{activity.owner.name}</span><span className="badge">Version {activity.version}</span></div></div>{canUpdate && <div className="activity-detail-actions"><Link className="secondary" href={`/activities/${id}/edit`}><Pencil aria-hidden="true" />แก้ไข</Link><ActivityDeleteButton id={id} version={activity.version} /></div>}</div>
    <div className="activity-detail-layout"><main className="activity-detail-main"><section className="card"><div className="card-header">รายละเอียดกิจกรรม</div><div className="card-body activity-copy-grid"><div><span>บันทึก</span><p>{activity.notes || activity.description || "—"}</p></div><div><span>ผลลัพธ์</span><p>{activity.outcome || "—"}</p></div><div><span>Customer Feedback</span><p>{activity.customerFeedback || "—"}</p></div><div><span>Next Action</span><p>{activity.nextAction || "—"}</p></div>{participants.length > 0 && <div><span>Participants</span><p>{participants.join(", ")}</p></div>}</div></section>
      <section className="card ai-activity-card"><div className="card-header">AI Meeting Insight</div><div className="card-body activity-copy-grid"><div><span>AI Summary</span><p>{activity.aiSummary || "ยังไม่มี AI Summary"}</p></div><div><span>Action Items</span><p>{activity.actionItems || "—"}</p></div></div></section></main>
      <aside className="card activity-context-card"><div className="card-header">บริบทที่เกี่ยวข้อง</div><div className="card-body activity-context-list">{activity.customer && <Link href={`/customers/${activity.customer.id}`}><span>Customer</span><strong>{activity.customer.name}</strong></Link>}{activity.opportunity && <Link href={`/opportunities/${activity.opportunity.id}`}><span>Opportunity</span><strong>{activity.opportunity.opportunityNumber ?? activity.opportunity.name}</strong><small>{activity.opportunity.name}</small></Link>}{activity.lead && <Link href={`/leads/${activity.lead.id}`}><span>Lead</span><strong>{activity.lead.leadNumber}</strong><small>{activity.lead.company}</small></Link>}{activity.prospect && <Link href={`/prospects/${activity.prospect.id}`}><span>Prospect</span><strong>{activity.prospect.prospectCode}</strong><small>{activity.prospect.companyName}</small></Link>}{!activity.customer && !activity.opportunity && !activity.lead && !activity.prospect && <div className="compact-empty">ยังไม่ได้เชื่อมกับรายการอื่น</div>}<div className="activity-timestamps"><span>สร้างเมื่อ</span><strong>{formatDate(activity.createdAt)}</strong><span>แก้ไขล่าสุด</span><strong>{formatDate(activity.updatedAt)}</strong></div></div></aside>
    </div></>;
}

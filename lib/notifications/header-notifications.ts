import { prisma } from "../prisma";

export type HeaderNotification = {
  id: string;
  title: string;
  description: string;
  href: string;
  occurredAt: string;
  tone: "INFO" | "WARNING" | "ACTION";
};

export async function loadHeaderNotifications(actorId: string): Promise<HeaderNotification[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1_000);
  const [activities, approvals, leads, surveys] = await Promise.all([
    prisma.activity.findMany({
      where: { ownerId: actorId, deletedAt: null, dueAt: { lte: horizon } },
      select: { id: true, subject: true, dueAt: true, opportunityId: true },
      orderBy: { dueAt: "asc" },
      take: 8,
    }),
    prisma.approvalRequest.findMany({
      where: { makerId: actorId, status: { in: ["PENDING", "PENDING_ESCALATION", "RETURNED", "REJECTED"] } },
      select: { id: true, status: true, submittedAt: true, quoteVersion: { select: { quote: { select: { id: true, quoteNo: true } } } } },
      orderBy: { submittedAt: "desc" },
      take: 8,
    }),
    prisma.lead.findMany({ where: { ownerId: actorId, OR: [{ nextFollowUpAt: { lte: horizon } }, { firstContactDueAt: { lte: horizon }, lastContactedAt: null }], status: { notIn: ["CONVERTED", "DISQUALIFIED", "ARCHIVED"] } }, select: { id: true, company: true, nextFollowUpAt: true, firstContactDueAt: true, lastContactedAt: true }, orderBy: { updatedAt: "desc" }, take: 8 }),
    prisma.siteSurveyRequest.findMany({ where: { AND: [{ OR: [{ assignedSurveyEngineerId: actorId }, { assignedCoordinatorId: actorId }] }, { statusCode: { notIn: ["RESULT_APPROVED", "CANCELLED"] } }, { OR: [{ scheduledSurveyDate: { lte: horizon } }, { statusCode: "RESULT_SUBMITTED" }] }] }, select: { id: true, surveyRequestNumber: true, statusCode: true, scheduledSurveyDate: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 8 }),
  ]);
  return [
    ...activities.map((activity): HeaderNotification => ({
      id: `activity:${activity.id}`,
      title: activity.dueAt && activity.dueAt < now ? "กิจกรรมเลยกำหนด" : "กิจกรรมใกล้ถึงกำหนด",
      description: activity.subject,
      href: activity.opportunityId ? `/opportunities/${activity.opportunityId}` : "/activities",
      occurredAt: (activity.dueAt ?? now).toISOString(),
      tone: activity.dueAt && activity.dueAt < now ? "WARNING" : "INFO",
    })),
    ...approvals.map((approval): HeaderNotification => ({
      id: `approval:${approval.id}`,
      title: approval.status === "RETURNED" || approval.status === "REJECTED" ? "ใบเสนอราคาต้องดำเนินการ" : "กำลังรอการอนุมัติ",
      description: `${approval.quoteVersion.quote.quoteNo} · ${approval.status}`,
      href: `/quotes/${approval.quoteVersion.quote.id}`,
      occurredAt: approval.submittedAt.toISOString(),
      tone: approval.status === "RETURNED" || approval.status === "REJECTED" ? "ACTION" : "INFO",
    })),
    ...leads.map((lead): HeaderNotification => { const dueAt=lead.lastContactedAt?lead.nextFollowUpAt:lead.firstContactDueAt??lead.nextFollowUpAt;const firstContact=!lead.lastContactedAt&&lead.firstContactDueAt!==null;return { id: `lead:${lead.id}`, title: firstContact?(dueAt&&dueAt<now?"Lead เกิน First Contact SLA":"Lead ใกล้ครบ First Contact SLA"):(dueAt&&dueAt<now?"Lead เกินกำหนดติดตาม":"Lead ใกล้ถึงกำหนดติดตาม"), description: lead.company, href: `/leads/${lead.id}`, occurredAt: (dueAt??now).toISOString(), tone: dueAt&&dueAt<now?"WARNING":"ACTION" };}),
    ...surveys.map((survey):HeaderNotification=>({id:`site-survey:${survey.id}`,title:survey.statusCode==="RESULT_SUBMITTED"?"Survey result awaiting review":survey.scheduledSurveyDate&&survey.scheduledSurveyDate<now?"Site Survey overdue":"Site Survey scheduled",description:`${survey.surveyRequestNumber} · ${survey.statusCode}`,href:`/site-surveys/${survey.id}`,occurredAt:(survey.scheduledSurveyDate??survey.updatedAt).toISOString(),tone:survey.statusCode==="RESULT_SUBMITTED"?"ACTION":survey.scheduledSurveyDate&&survey.scheduledSurveyDate<now?"WARNING":"INFO"})),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 10);
}

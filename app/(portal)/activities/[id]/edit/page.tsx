import { notFound } from "next/navigation";

import { ActivityEditForm } from "@/components/activity-management";
import { buildActivityScopeWhere } from "@/lib/activity/activity-authorization";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { buildCustomerScopeWhere } from "@/lib/customer/customer-query-service";
import { buildOpportunityScopeWhere } from "@/lib/opportunity/opportunity-query";
import { prisma } from "@/lib/prisma";

function localDateTime(value: Date | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(); if (session.role === "VIEWER") notFound();
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role }); const { id } = await params;
  const [activity, customers, opportunities] = await Promise.all([
    prisma.activity.findFirst({ where: { id, deletedAt: null, ...buildActivityScopeWhere(authorization) }, select: { id: true, version: true, subject: true, type: true, dueAt: true, notes: true, customerId: true, opportunityId: true } }),
    prisma.customer.findMany({ where: { mergedIntoCustomerId: null, ...buildCustomerScopeWhere(authorization) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.opportunity.findMany({ where: buildOpportunityScopeWhere(authorization), select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!activity) notFound();
  return <><div className="page-head"><div><p className="eyebrow">Activity & Meeting</p><h1>แก้ไข Activity</h1><p>{activity.subject}</p></div></div><ActivityEditForm value={{ id: activity.id, version: activity.version, subject: activity.subject, type: activity.type, dueAt: localDateTime(activity.dueAt), notes: activity.notes ?? "", customerId: activity.customerId ?? "", opportunityId: activity.opportunityId ?? "" }} customers={customers} opportunities={opportunities} /></>;
}

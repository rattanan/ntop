import { notFound } from "next/navigation";

import { LeadAssignmentRuleConsole } from "@/components/lead-assignment-rule-console";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import { requirePermission } from "@/lib/authorization/require-permission";
import { LEAD_ASSIGNMENT_RULE_ADMIN_ROLES } from "@/lib/lead/lead-rules";
import { prisma } from "@/lib/prisma";

export default async function LeadManagementAdministrationPage() {
  const session = await requirePermission(PERMISSIONS.workflowConfigManage);
  const context = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  if (!context.assignments.some(item => (LEAD_ASSIGNMENT_RULE_ADMIN_ROLES as readonly string[]).includes(item.role))) notFound();
  const [rules, users, organizationUnits] = await Promise.all([
    prisma.leadAssignmentRule.findMany({ orderBy: [{ priority: "asc" }, { id: "asc" }], take: 200 }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
    prisma.organizationUnit.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
  ]);
  const values = rules.map(rule => ({ ...rule, criteria: typeof rule.criteria === "object" && rule.criteria && !Array.isArray(rule.criteria) ? Object.fromEntries(Object.entries(rule.criteria).filter((entry): entry is [string, string] => typeof entry[1] === "string")) : {} }));
  return <><div className="page-head"><div><p className="eyebrow">Administration</p><h1>Lead Assignment Rules</h1><p>กฎเรียงจาก priority ต่ำไปสูง ทุกการเปลี่ยนแปลงตรวจสิทธิ์และเขียน audit log ฝั่ง server</p></div></div><LeadAssignmentRuleConsole rules={values} users={users} organizationUnits={organizationUnits}/></>;
}

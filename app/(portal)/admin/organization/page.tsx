import {
  AssignOrganizationApproverForm,
  CreateOrganizationForm,
  UpdateHierarchyForm,
} from "@/components/organization-admin-console";
import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import { requirePermission } from "@/lib/authorization/require-permission";
import { prisma } from "@/lib/prisma";

type Organization = { id: string; code: string; name: string; parentId: string | null };

function orderHierarchy(rows: Organization[]) {
  const byParent = new Map<string | null, Organization[]>();
  for (const row of rows) {
    const siblings = byParent.get(row.parentId) ?? [];
    siblings.push(row);
    byParent.set(row.parentId, siblings);
  }
  for (const siblings of byParent.values()) siblings.sort((a, b) => a.code.localeCompare(b.code));

  const ordered: Array<Organization & { depth: number }> = [];
  const visited = new Set<string>();
  const visit = (parentId: string | null, depth: number) => {
    for (const row of byParent.get(parentId) ?? []) {
      if (visited.has(row.id)) continue;
      visited.add(row.id);
      ordered.push({ ...row, depth });
      visit(row.id, depth + 1);
    }
  };
  visit(null, 0);
  for (const row of rows) {
    if (!visited.has(row.id)) ordered.push({ ...row, depth: 0 });
  }
  return ordered;
}

export default async function OrganizationAdministrationPage() {
  await requirePermission(PERMISSIONS.organizationManage);
  const now = new Date();
  const [organizationRows, users, assignments, authorities] = await Promise.all([
    prisma.organizationUnit.findMany({
      where: { active: true },
      take: 500,
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, parentId: true },
    }),
    prisma.user.findMany({
      where: { active: true },
      take: 500,
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.userRoleAssignment.findMany({
      where: {
        active: true,
        scopeCode: "ORG_UNIT",
        organizationUnitId: { not: null },
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      take: 500,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        organizationUnit: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.approvalAuthorityGrant.findMany({
      where: {
        active: true,
        permissionCode: PERMISSIONS.approvalDecide,
        organizationUnitId: { not: null },
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      take: 500,
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const organizations = orderHierarchy(organizationRows);
  const authorityByScope = new Map(
    authorities.map((authority) => [
      `${authority.roleCode}:${authority.organizationUnitId}`,
      authority,
    ]),
  );
  const approvers = assignments.flatMap((assignment) => {
    const authority = authorityByScope.get(`${assignment.roleCode}:${assignment.organizationUnitId}`);
    return authority && assignment.organizationUnit ? [{ assignment, authority }] : [];
  });

  return <><div className="page-head"><div><p className="eyebrow">Organization Administration</p><h1>หน่วยงานและผู้อนุมัติ</h1><p>จัดโครงสร้างหน่วยงานและกำหนดผู้จัดการให้มีอำนาจอนุมัติ Quotation ตาม policy, scope และวงเงิน</p></div></div>
    <div className="stats"><section className="card stat"><p>หน่วยงาน</p><strong>{organizations.length}</strong></section><section className="card stat"><p>หน่วยงานระดับบนสุด</p><strong>{organizations.filter((item) => !item.parentId).length}</strong></section><section className="card stat"><p>ผู้อนุมัติที่มีผล</p><strong>{approvers.length}</strong></section></div>
    <div className="grid-2"><CreateOrganizationForm organizations={organizations}/><UpdateHierarchyForm organizations={organizations}/></div>
    <div style={{ marginTop: 20 }}><AssignOrganizationApproverForm users={users} organizations={organizations}/></div>
    <section className="card" style={{ marginTop: 20 }}><div className="card-body"><h2>Organization hierarchy</h2><p className="help">แสดงหน่วยงานที่เปิดใช้งาน สูงสุด 500 รายการ</p></div><div className="table-wrap"><table className="table"><thead><tr><th>หน่วยงาน</th><th>ระดับ</th><th>หน่วยงานแม่</th></tr></thead><tbody>{organizations.map((organization) => { const parent = organization.parentId ? organizationRows.find((item) => item.id === organization.parentId) : null; return <tr key={organization.id}><td><strong>{"— ".repeat(organization.depth)}{organization.code}</strong><br/><small>{organization.name}</small></td><td>{organization.depth + 1}</td><td>{parent ? `${parent.code} — ${parent.name}` : "ระดับบนสุด"}</td></tr>; })}</tbody></table></div></section>
    <section className="card" style={{ marginTop: 20 }}><div className="card-body"><h2>ผู้จัดการที่มีอำนาจอนุมัติ Quotation</h2><p className="help">การอนุมัติจริงยังตรวจ maker-checker, role ใน Approval Policy, หน่วยงาน, segment และวงเงินฝั่ง server ทุกครั้ง</p></div><div className="table-wrap"><table className="table"><thead><tr><th>ผู้อนุมัติ</th><th>หน่วยงาน</th><th>Role</th><th>วงเงิน / Segment</th><th>ช่วงมีผล</th></tr></thead><tbody>{approvers.length ? approvers.map(({ assignment, authority }) => <tr key={assignment.id}><td><strong>{assignment.user.name}</strong><br/><small>{assignment.user.email}</small></td><td>{assignment.organizationUnit?.code} — {assignment.organizationUnit?.name}</td><td><span className="badge success">{assignment.roleCode}</span></td><td>{authority.maximumAmount.toString()}<br/><small>{authority.customerSegment ?? "ทุก segment"}</small></td><td>{assignment.effectiveFrom.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })} – {assignment.effectiveTo?.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }) ?? "ไม่มีกำหนด"}</td></tr>) : <tr><td colSpan={5}>ยังไม่มีผู้อนุมัติที่มีผล</td></tr>}</tbody></table></div></section>
  </>;
}

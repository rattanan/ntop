import Link from "next/link";
import { CreateOrganizationForm, OrganizationUnitRowActions, UpdateHierarchyForm } from "@/components/organization-admin-console";
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
  const organizationRows = await prisma.organizationUnit.findMany({
      where: { active: true },
      take: 500,
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, parentId: true },
    });
  const organizations = orderHierarchy(organizationRows);

  return <><div className="page-head"><div><p className="eyebrow">Organization Administration</p><h1>โครงสร้างหน่วยงาน</h1><p>จัดการหน่วยงานและสายบังคับบัญชา การตั้งค่า Approver และวงเงินถูกรวมไว้ที่ Approval Control Center</p></div><Link className="secondary" href="/admin/workflow">ไป Approval Control Center</Link></div>
    <div className="stats"><section className="card stat"><p>หน่วยงาน</p><strong>{organizations.length}</strong></section><section className="card stat"><p>หน่วยงานระดับบนสุด</p><strong>{organizations.filter((item) => !item.parentId).length}</strong></section></div>
    <div className="grid-2"><CreateOrganizationForm organizations={organizations}/><UpdateHierarchyForm organizations={organizations}/></div>
    <section className="card" style={{ marginTop: 20 }}><div className="card-body"><h2>Organization hierarchy</h2><p className="help">แสดงหน่วยงานที่เปิดใช้งาน สูงสุด 500 รายการ</p></div><div className="table-wrap"><table className="table"><thead><tr><th>หน่วยงาน</th><th>ระดับ</th><th>หน่วยงานแม่</th><th>จัดการ</th></tr></thead><tbody>{organizations.map((organization) => { const parent = organization.parentId ? organizationRows.find((item) => item.id === organization.parentId) : null; return <tr key={organization.id}><td><strong>{"— ".repeat(organization.depth)}{organization.code}</strong><br/><small>{organization.name}</small></td><td>{organization.depth + 1}</td><td>{parent ? `${parent.code} — ${parent.name}` : "ระดับบนสุด"}</td><td><OrganizationUnitRowActions organization={organization}/></td></tr>; })}</tbody></table></div></section>
  </>;
}

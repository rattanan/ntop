import Link from "next/link";
import { AssignRoleForm, CreateUserForm, RevokeRoleForm, UpdateUserForm } from "@/components/admin-user-console";
import { requirePermission } from "@/lib/authorization/require-permission";
import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import { prisma } from "@/lib/prisma";

export default async function IdentityAdministrationPage() {
  const session = await requirePermission(PERMISSIONS.userAdminManage);
  const [users, orgs] = await Promise.all([
    prisma.user.findMany({ take: 200, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, email: true, role: true, active: true, updatedAt: true, enterpriseRoleAssignments: { take: 20, orderBy: { createdAt: "desc" }, include: { organizationUnit: { select: { code: true, name: true } } } } } }),
    prisma.organizationUnit.findMany({ where: { active: true }, take: 200, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  const activeUsers = users.filter(user=>user.active).map(({id,name,email})=>({id,name,email}));

  return <><div className="page-head"><div><p className="eyebrow">Identity & Access Administration</p><h1>ผู้ใช้งานและสิทธิ์</h1><p>จัดการบัญชี Legacy role และ Enterprise role สูงสุด 200 บัญชีล่าสุด</p></div><Link className="secondary" href="/admin/audit">เปิด Login & Audit Log</Link></div>
    <div className="stats"><section className="card stat"><p>ผู้ใช้งาน</p><strong>{users.length}</strong></section><section className="card stat"><p>เปิดใช้งาน</p><strong>{activeUsers.length}</strong></section></div>
    <div className="form-grid"><CreateUserForm/><AssignRoleForm users={activeUsers} orgs={orgs}/></div>
    <section className="card"><div className="card-body"><h2>จัดการผู้ใช้งานและ role</h2></div><div className="table-wrap"><table className="table"><thead><tr><th>บัญชี</th><th>Legacy role / สถานะ</th><th>Enterprise assignments</th><th>แก้ไข</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td><strong>{user.name}</strong><br/><small>{user.email}</small></td><td><span className="badge">{user.role}</span> <span className={`badge ${user.active?"success":"muted"}`}>{user.active?"เปิดใช้งาน":"ปิดใช้งาน"}</span></td><td>{user.enterpriseRoleAssignments.length ? user.enterpriseRoleAssignments.map(item=><div key={item.id} style={{marginBottom:8}}><span className={`badge ${item.active?"success":"muted"}`}>{item.roleCode} · {item.scopeCode}</span> <small>{item.organizationUnit?.name??"ทุกหน่วยงาน"}</small>{item.active&&<RevokeRoleForm assignmentId={item.id} disabled={user.id===session.id}/>}</div>) : "—"}</td><td><UpdateUserForm user={user} self={user.id===session.id}/></td></tr>)}</tbody></table></div></section>
  </>;
}

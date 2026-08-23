import { ChevronRight, Pencil } from "lucide-react";
import Link from "next/link";

import { CreateUserForm } from "@/components/admin-user-console";
import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import { requirePermission } from "@/lib/authorization/require-permission";
import { prisma } from "@/lib/prisma";

const formatDate = (value: Date) => value.toLocaleDateString("th-TH", {
  timeZone: "Asia/Bangkok",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function IdentityAdministrationPage() {
  await requirePermission(PERMISSIONS.userAdminManage);
  const users = await prisma.user.findMany({
    take: 200,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      apiKeyPrefix: true,
      updatedAt: true,
      enterpriseRoleAssignments: {
        take: 20,
        orderBy: { createdAt: "desc" },
        select: { id: true, roleCode: true, active: true },
      },
    },
  });
  const activeUsers = users.filter((user) => user.active);
  const activeAssignments = users.reduce(
    (total, user) => total + user.enterpriseRoleAssignments.filter((assignment) => assignment.active).length,
    0,
  );

  return <>
    <div className="page-head">
      <div>
        <p className="eyebrow">Identity &amp; Access Administration</p>
        <h1>ผู้ใช้งานและสิทธิ์</h1>
        <p>ดูภาพรวมบัญชีแบบกระชับ และเปิดหน้าเฉพาะเมื่อต้องการแก้ไขรายละเอียด</p>
      </div>
      <Link className="secondary" href="/admin/audit">เปิด Login &amp; Audit Log</Link>
    </div>

    <div className="stats identity-stats">
      <section className="card stat"><p>ผู้ใช้งาน</p><strong>{users.length}</strong></section>
      <section className="card stat"><p>เปิดใช้งาน</p><strong>{activeUsers.length}</strong></section>
      <section className="card stat"><p>Enterprise roles ที่เปิดใช้</p><strong>{activeAssignments}</strong></section>
    </div>

    <CreateUserForm />

    <section className="card identity-list-card">
      <div className="identity-list-head">
        <div>
          <h2>รายชื่อผู้ใช้งาน</h2>
          <p>แสดงสูงสุด 200 บัญชีล่าสุด · เลือกแก้ไขเพื่อจัดการข้อมูล, API Key และ Enterprise role</p>
        </div>
        <span>{users.length} บัญชี</span>
      </div>
      <div className="table-wrap identity-user-table-wrap">
        <table className="table identity-user-table">
          <thead><tr><th>บัญชี</th><th>สิทธิ์การใช้งาน</th><th>InsightKM</th><th>แก้ไขล่าสุด</th><th><span className="sr-only">การทำงาน</span></th></tr></thead>
          <tbody>{users.length ? users.map((user) => {
            const activeUserAssignments = user.enterpriseRoleAssignments.filter((assignment) => assignment.active);
            const roleCodes = [...new Set(activeUserAssignments.map((assignment) => assignment.roleCode))];
            return <tr key={user.id}>
              <td data-label="บัญชี">
                <div className="identity-account-cell">
                  <span className="identity-avatar" aria-hidden="true">{user.name.trim().charAt(0).toUpperCase() || "U"}</span>
                  <span><strong>{user.name}</strong><small>{user.email}</small></span>
                </div>
              </td>
              <td data-label="สิทธิ์การใช้งาน">
                <div className="identity-access-summary">
                  <span className="badge">{user.role}</span>
                  <span className={`badge ${user.active ? "success" : "muted"}`}>{user.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</span>
                </div>
                <small className="identity-cell-note">
                  {activeUserAssignments.length
                    ? `${activeUserAssignments.length} assignment · ${roleCodes.slice(0, 2).join(", ")}${roleCodes.length > 2 ? " …" : ""}`
                    : "ยังไม่มี Enterprise role ที่เปิดใช้"}
                </small>
              </td>
              <td data-label="InsightKM">
                <span className={`identity-key-status ${user.apiKeyPrefix ? "connected" : ""}`}>
                  <span aria-hidden="true" />{user.apiKeyPrefix ? "เชื่อมต่อแล้ว" : "ยังไม่เชื่อมต่อ"}
                </span>
                <small className="identity-cell-note">{user.apiKeyPrefix ? `ntop_${user.apiKeyPrefix}_••••` : "สร้าง API Key ในหน้าแก้ไข"}</small>
              </td>
              <td data-label="แก้ไขล่าสุด"><span className="identity-date">{formatDate(user.updatedAt)}</span></td>
              <td className="identity-row-action">
                <Link className="secondary identity-edit-link" href={`/admin/users/${user.id}/edit`} aria-label={`แก้ไขผู้ใช้ ${user.name}`}>
                  <Pencil aria-hidden="true" /><span>แก้ไข</span><ChevronRight aria-hidden="true" />
                </Link>
              </td>
            </tr>;
          }) : <tr><td className="empty" colSpan={5}>ยังไม่มีผู้ใช้งาน</td></tr>}</tbody>
        </table>
      </div>
    </section>
  </>;
}

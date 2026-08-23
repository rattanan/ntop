import { ArrowLeft, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AssignRoleForm,
  RevokeRoleForm,
  UpdateRoleAssignmentOrganizationForm,
  UpdateUserForm,
  UserApiKeyForm,
} from "@/components/admin-user-console";
import { PERMISSIONS } from "@/lib/authorization/permission-policy";
import { requirePermission } from "@/lib/authorization/require-permission";
import { prisma } from "@/lib/prisma";

const formatDate = (value: Date) => value.toLocaleDateString("th-TH", {
  timeZone: "Asia/Bangkok",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function EditAdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission(PERMISSIONS.userAdminManage);
  const { id } = await params;
  const [user, orgs] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        apiKeyPrefix: true,
        apiKeyCreatedAt: true,
        updatedAt: true,
        enterpriseRoleAssignments: {
          take: 20,
          orderBy: { createdAt: "desc" },
          include: { organizationUnit: { select: { code: true, name: true } } },
        },
      },
    }),
    prisma.organizationUnit.findMany({
      where: { active: true },
      take: 200,
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);
  if (!user) notFound();

  const self = user.id === session.id;
  const activeAssignments = user.enterpriseRoleAssignments.filter((assignment) => assignment.active);

  return <>
    <div className="page-head identity-edit-head">
      <div>
        <Link className="back-link" href="/admin/users"><ArrowLeft aria-hidden="true" />กลับรายชื่อผู้ใช้งาน</Link>
        <p className="eyebrow">Identity &amp; Access Administration</p>
        <h1>แก้ไขรายละเอียดผู้ใช้งาน</h1>
        <p>ข้อมูลบัญชี, การเชื่อมต่อ InsightKM และสิทธิ์ Enterprise ของ {user.name}</p>
      </div>
    </div>

    <section className="card identity-profile-summary">
      <span className="identity-profile-avatar" aria-hidden="true">{user.name.trim().charAt(0).toUpperCase() || "U"}</span>
      <div className="identity-profile-name"><strong>{user.name}</strong><span>{user.email}</span></div>
      <div className="identity-profile-meta"><span className="badge">{user.role}</span><span className={`badge ${user.active ? "success" : "muted"}`}>{user.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</span></div>
      <div className="identity-profile-updated"><small>แก้ไขล่าสุด</small><strong>{formatDate(user.updatedAt)}</strong></div>
    </section>

    {self && <div className="notice notice-warning identity-self-notice" role="status">คุณกำลังดูบัญชีของตนเอง ระบบจึงล็อก Legacy role, สถานะบัญชี และ Enterprise assignments เพื่อป้องกัน self-grant หรือ lockout</div>}

    <div className="identity-edit-layout">
      <div className="identity-edit-stack">
        <section className="card identity-editor-card">
          <div className="card-header identity-section-title"><UserRound aria-hidden="true" /><div><strong>ข้อมูลบัญชี</strong><small>แก้ไขชื่อ, Legacy role และสถานะ</small></div></div>
          <div className="card-body"><UpdateUserForm user={user} self={self}/></div>
        </section>
        <section className="card identity-editor-card">
          <div className="card-header identity-section-title"><KeyRound aria-hidden="true" /><div><strong>InsightKM API Key</strong><small>Key ที่สร้างใหม่จะแสดงเพียงครั้งเดียว</small></div></div>
          <div className="card-body"><UserApiKeyForm user={user}/></div>
        </section>
      </div>

      <div className="identity-edit-stack">
        <section className="card identity-editor-card">
          <div className="card-header identity-section-title">
            <ShieldCheck aria-hidden="true" />
            <div><strong>Enterprise assignments</strong><small>{activeAssignments.length} รายการที่เปิดใช้งาน · แสดงสูงสุด 20 รายการล่าสุด</small></div>
          </div>
          <div className="identity-assignment-list">
            {user.enterpriseRoleAssignments.length ? user.enterpriseRoleAssignments.map((assignment) => <article className="identity-assignment-card" key={assignment.id}>
              <div className="identity-assignment-card-head">
                <div><span className={`badge ${assignment.active ? "success" : "muted"}`}>{assignment.roleCode}</span><span className="badge muted">{assignment.scopeCode}</span></div>
                <span className={`identity-assignment-state ${assignment.active ? "active" : ""}`}>{assignment.active ? "ใช้งาน" : "ถอนแล้ว"}</span>
              </div>
              <dl className="identity-assignment-details">
                <div><dt>หน่วยงาน</dt><dd>{assignment.organizationUnit ? `${assignment.organizationUnit.code} — ${assignment.organizationUnit.name}` : "ทุกหน่วยงาน / ไม่ระบุ"}</dd></div>
                <div><dt>ช่วงมีผล</dt><dd>{formatDate(assignment.effectiveFrom)} – {assignment.effectiveTo ? formatDate(assignment.effectiveTo) : "ไม่มีกำหนด"}</dd></div>
              </dl>
              {assignment.active && <div className="identity-assignment-actions">
                <UpdateRoleAssignmentOrganizationForm assignment={assignment} orgs={orgs} disabled={self}/>
                <RevokeRoleForm assignmentId={assignment.id} disabled={self}/>
              </div>}
            </article>) : <div className="empty identity-assignment-empty"><ShieldCheck aria-hidden="true" /><strong>ยังไม่มี Enterprise role</strong><span>เพิ่ม role เพื่อกำหนดขอบเขตการเข้าถึงของผู้ใช้งาน</span></div>}
          </div>
        </section>

        {!self && user.active && <AssignRoleForm user={user} orgs={orgs}/>} 
        {!self && !user.active && <div className="notice notice-info" role="status">บัญชีนี้ปิดใช้งานอยู่ กรุณาเปิดใช้งานบัญชีก่อนเพิ่ม Enterprise role</div>}
      </div>
    </div>
  </>;
}

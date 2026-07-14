"use client";

import { useActionState } from "react";
import type { Role } from "@prisma/client";
import { assignAdminRole, createAdminUser, revokeAdminRole, updateAdminUser } from "@/app/actions/identity-admin";
import type { FormState } from "@/app/action-types";
import { FormNotice } from "@/components/notice";
import { AUTHORIZATION_SCOPES, ENTERPRISE_ROLES } from "@/lib/authorization/enterprise-role-policy";

const initial: FormState = {};
const legacyRoles: Role[] = ["ADMIN", "SALES", "VIEWER"];
type Org = { id: string; code: string; name: string };

function Result({ state }: { state: FormState }) { return <FormNotice state={state}/>; }

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createAdminUser, initial);
  return <form action={action} className="card form-card"><div className="card-body"><h2>สร้างผู้ใช้งาน</h2><div className="form-grid"><label className="field"><span>ชื่อ</span><input className="control" name="name" required minLength={2}/></label><label className="field"><span>อีเมล</span><input className="control" name="email" type="email" required/></label><label className="field"><span>รหัสผ่านเริ่มต้น</span><input className="control" name="password" type="password" minLength={12} autoComplete="new-password" required/><small className="help">อย่างน้อย 12 ตัวอักษร</small></label><label className="field"><span>Legacy role</span><select className="control" name="role" defaultValue="SALES">{legacyRoles.map(role=><option key={role}>{role}</option>)}</select></label></div><Result state={state}/><div className="actions"><button className="primary" disabled={pending}>{pending ? "กำลังสร้าง…" : "สร้างผู้ใช้งาน"}</button></div></div></form>;
}

export function UpdateUserForm({ user, self }: { user: { id: string; name: string; role: Role; active: boolean }; self: boolean }) {
  const [state, action, pending] = useActionState(updateAdminUser, initial);
  return <form action={action}><input type="hidden" name="userId" value={user.id}/><input className="control" name="name" defaultValue={user.name} required minLength={2}/><select className="control" name="role" defaultValue={user.role} disabled={self}>{legacyRoles.map(role=><option key={role}>{role}</option>)}</select>{self&&<input type="hidden" name="role" value={user.role}/>}<label className="help"><input type="checkbox" name="active" defaultChecked={user.active} disabled={self}/> เปิดใช้งาน</label>{self&&<input type="hidden" name="active" value="on"/>}<Result state={state}/><button className="secondary" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึก"}</button></form>;
}

export function AssignRoleForm({ users, orgs }: { users: { id: string; name: string; email: string }[]; orgs: Org[] }) {
  const [state, action, pending] = useActionState(assignAdminRole, initial);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <form action={action} className="card form-card"><div className="card-body"><h2>มอบหมาย Enterprise role</h2><div className="form-grid"><label className="field"><span>ผู้ใช้งาน</span><select className="control" name="userId">{users.map(user=><option value={user.id} key={user.id}>{user.name} — {user.email}</option>)}</select></label><label className="field"><span>Role</span><select className="control" name="roleCode">{ENTERPRISE_ROLES.map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Scope</span><select className="control" name="scopeCode">{AUTHORIZATION_SCOPES.map(value=><option key={value}>{value}</option>)}</select></label><label className="field"><span>หน่วยงาน</span><select className="control" name="organizationUnitId"><option value="">ไม่ระบุ</option>{orgs.map(org=><option value={org.id} key={org.id}>{org.code} — {org.name}</option>)}</select></label><label className="field"><span>เริ่มใช้</span><input className="control" type="date" name="effectiveFrom" defaultValue={today} required/></label><label className="field"><span>สิ้นสุด</span><input className="control" type="date" name="effectiveTo"/></label></div><Result state={state}/><div className="actions"><button className="primary" disabled={pending}>{pending ? "กำลังมอบหมาย…" : "มอบหมาย role"}</button></div></div></form>;
}

export function RevokeRoleForm({ assignmentId, disabled }: { assignmentId: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(revokeAdminRole, initial);
  return <form action={action}><input type="hidden" name="assignmentId" value={assignmentId}/><button className="secondary" disabled={disabled||pending}>{pending ? "กำลังถอน…" : "ถอนสิทธิ์"}</button><Result state={state}/></form>;
}

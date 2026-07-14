"use client";

import { useActionState } from "react";

import {
  assignOrganizationApprover,
  createOrganizationUnit,
  updateOrganizationHierarchy,
} from "@/app/actions/organization-admin";
import type { FormState } from "@/app/action-types";
import { FormNotice } from "@/components/notice";
import { ENTERPRISE_ROLES } from "@/lib/authorization/enterprise-role-policy";

type OrganizationOption = { id: string; code: string; name: string; depth: number };
type UserOption = { id: string; name: string; email: string };
const initial: FormState = {};

function Result({ state }: { state: FormState }) {
  return <FormNotice state={state}/>;
}

function OrganizationOptions({ organizations, excludeId }: { organizations: OrganizationOption[]; excludeId?: string }) {
  return organizations.filter((organization) => organization.id !== excludeId).map((organization) => (
    <option value={organization.id} key={organization.id}>
      {"— ".repeat(organization.depth)}{organization.code} — {organization.name}
    </option>
  ));
}

export function CreateOrganizationForm({ organizations }: { organizations: OrganizationOption[] }) {
  const [state, action, pending] = useActionState(createOrganizationUnit, initial);
  return <form action={action} className="card form-card"><div className="card-body"><h2>สร้างหน่วยงาน</h2><div className="form-grid"><label className="field"><span>รหัสหน่วยงาน</span><input className="control" name="code" placeholder="เช่น SALES-CENTRAL" minLength={2} maxLength={100} pattern="[A-Za-z0-9][A-Za-z0-9._-]*" required/></label><label className="field"><span>ชื่อหน่วยงาน</span><input className="control" name="name" minLength={2} maxLength={255} required/></label><label className="field"><span>หน่วยงานแม่</span><select className="control" name="parentId"><option value="">หน่วยงานระดับบนสุด</option><OrganizationOptions organizations={organizations}/></select></label></div><Result state={state}/><div className="actions"><button className="primary" disabled={pending}>{pending ? "กำลังสร้าง…" : "สร้างหน่วยงาน"}</button></div></div></form>;
}

export function UpdateHierarchyForm({ organizations }: { organizations: OrganizationOption[] }) {
  const [state, action, pending] = useActionState(updateOrganizationHierarchy, initial);
  return <form action={action} className="card form-card"><div className="card-body"><h2>จัดลำดับชั้นหน่วยงาน</h2><div className="form-grid"><label className="field"><span>หน่วยงานที่ต้องการย้าย</span><select className="control" name="organizationUnitId" required><option value="" disabled>เลือกหน่วยงาน</option><OrganizationOptions organizations={organizations}/></select></label><label className="field"><span>หน่วยงานแม่ใหม่</span><select className="control" name="parentId"><option value="">ย้ายเป็นระดับบนสุด</option><OrganizationOptions organizations={organizations}/></select><small className="help">ระบบตรวจและป้องกัน hierarchy ที่เป็นวงวนฝั่ง server</small></label></div><Result state={state}/><div className="actions"><button className="secondary" disabled={pending}>{pending ? "กำลังย้าย…" : "บันทึก hierarchy"}</button></div></div></form>;
}

export function AssignOrganizationApproverForm({ users, organizations }: { users: UserOption[]; organizations: OrganizationOption[] }) {
  const [state, action, pending] = useActionState(assignOrganizationApprover, initial);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <form action={action} className="card form-card"><div className="card-body"><h2>กำหนดผู้จัดการ / ผู้อนุมัติ Quotation</h2><p className="help">สร้าง ORG_UNIT role และวงเงินอนุมัติพร้อมกัน บทบาทที่เลือกต้องตรงกับ Approval Policy ที่ใช้งาน</p><div className="form-grid"><label className="field"><span>ผู้จัดการหน่วยงาน</span><select className="control" name="userId" required><option value="" disabled>เลือกผู้ใช้งาน</option>{users.map((user) => <option value={user.id} key={user.id}>{user.name} — {user.email}</option>)}</select></label><label className="field"><span>หน่วยงาน</span><select className="control" name="organizationUnitId" required><option value="" disabled>เลือกหน่วยงาน</option><OrganizationOptions organizations={organizations}/></select></label><label className="field"><span>บทบาทตาม Approval Policy</span><select className="control" name="roleCode" required><option value="" disabled>เลือกบทบาท</option>{ENTERPRISE_ROLES.map((role) => <option key={role}>{role}</option>)}</select></label><label className="field"><span>วงเงินอนุมัติสูงสุด</span><input className="control" name="maximumAmount" inputMode="decimal" pattern="\d+(\.\d{1,4})?" placeholder="0.0000" required/></label><label className="field"><span>Customer segment (ถ้ามี)</span><input className="control" name="customerSegment" maxLength={100}/></label><label className="field"><span>เริ่มมีผล</span><input className="control" type="date" name="effectiveFrom" defaultValue={today} required/></label><label className="field"><span>สิ้นสุด</span><input className="control" type="date" name="effectiveTo"/></label></div><Result state={state}/><div className="actions"><button className="primary" disabled={pending}>{pending ? "กำลังกำหนด…" : "กำหนดเป็นผู้อนุมัติ"}</button></div></div></form>;
}

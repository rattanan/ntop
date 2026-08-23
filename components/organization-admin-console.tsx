"use client";

import { Pencil, Trash2, X } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import {
  assignOrganizationApprover,
  createOrganizationUnit,
  removeOrganizationApprover,
  removeOrganizationUnit,
  updateOrganizationHierarchy,
  updateOrganizationUnit,
} from "@/app/actions/organization-admin";
import type { FormState } from "@/app/action-types";
import { FormNotice } from "@/components/notice";
import { ORGANIZATION_CODE_PATTERN_SOURCE } from "@/lib/administration/organization-code";
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
  return <form action={action} className="card form-card"><div className="card-body"><h2>สร้างหน่วยงาน</h2><div className="form-grid"><label className="field"><span>รหัสหน่วยงาน</span><input className="control" name="code" placeholder="เช่น ออธ.3 หรือ SALES-CENTRAL" minLength={2} maxLength={100} pattern={ORGANIZATION_CODE_PATTERN_SOURCE} title="ใช้ตัวอักษร (รวมภาษาไทยและอังกฤษ) ตัวเลข จุด ขีดกลาง หรือขีดล่าง โดยต้องขึ้นต้นด้วยตัวอักษรหรือตัวเลข" required/><small className="help">ใช้ตัวอักษร (รวมภาษาไทยและอังกฤษ) ตัวเลข จุด (.) ขีดกลาง (-) หรือขีดล่าง (_)</small></label><label className="field"><span>ชื่อหน่วยงาน</span><input className="control" name="name" minLength={2} maxLength={255} required/></label><label className="field"><span>หน่วยงานแม่</span><select className="control" name="parentId"><option value="">หน่วยงานระดับบนสุด</option><OrganizationOptions organizations={organizations}/></select></label></div><Result state={state}/><div className="actions"><button className="primary" disabled={pending}>{pending ? "กำลังสร้าง…" : "สร้างหน่วยงาน"}</button></div></div></form>;
}

export function UpdateHierarchyForm({ organizations }: { organizations: OrganizationOption[] }) {
  const [state, action, pending] = useActionState(updateOrganizationHierarchy, initial);
  return <form action={action} className="card form-card"><div className="card-body"><h2>จัดลำดับชั้นหน่วยงาน</h2><div className="form-grid"><label className="field"><span>หน่วยงานที่ต้องการย้าย</span><select className="control" name="organizationUnitId" required><option value="" disabled>เลือกหน่วยงาน</option><OrganizationOptions organizations={organizations}/></select></label><label className="field"><span>หน่วยงานแม่ใหม่</span><select className="control" name="parentId"><option value="">ย้ายเป็นระดับบนสุด</option><OrganizationOptions organizations={organizations}/></select><small className="help">ระบบตรวจและป้องกัน hierarchy ที่เป็นวงวนฝั่ง server</small></label></div><Result state={state}/><div className="actions"><button className="secondary" disabled={pending}>{pending ? "กำลังย้าย…" : "บันทึก hierarchy"}</button></div></div></form>;
}

export function OrganizationUnitRowActions({ organization }: { organization: OrganizationOption }) {
  const editDialog = useRef<HTMLDialogElement>(null);
  const removeDialog = useRef<HTMLDialogElement>(null);
  const [editState, editAction, editPending] = useActionState(updateOrganizationUnit, initial);
  const [removeState, removeAction, removePending] = useActionState(removeOrganizationUnit, initial);
  useEffect(() => { if (editState.status === "success") editDialog.current?.close(); }, [editState]);
  useEffect(() => { if (removeState.status === "success") removeDialog.current?.close(); }, [removeState]);
  const editTitleId = `edit-organization-${organization.id}`;
  const removeTitleId = `remove-organization-${organization.id}`;

  return <div className="row-actions"><button className="row-action" type="button" onClick={() => editDialog.current?.showModal()}><Pencil aria-hidden="true"/>แก้ไข</button><button className="danger-secondary" type="button" onClick={() => removeDialog.current?.showModal()}><Trash2 aria-hidden="true"/>ลบ</button>
    <dialog className="confirm-dialog" ref={editDialog} aria-labelledby={editTitleId} onCancel={(event) => { if (editPending) event.preventDefault(); }}><form action={editAction}><div className="confirm-dialog-head"><div><strong id={editTitleId}>แก้ไขหน่วยงาน</strong><small>แก้ไขรหัสและชื่อโดยไม่กระทบ hierarchy</small></div><button className="dialog-close" type="button" aria-label="ปิดหน้าต่าง" disabled={editPending} onClick={() => editDialog.current?.close()}><X aria-hidden="true"/></button></div><div className="confirm-dialog-body"><input type="hidden" name="organizationUnitId" value={organization.id}/><div className="form-grid"><label className="field"><span>รหัสหน่วยงาน <span className="required">*</span></span><input className="control" name="code" defaultValue={organization.code} minLength={2} maxLength={100} pattern={ORGANIZATION_CODE_PATTERN_SOURCE} required autoFocus/></label><label className="field"><span>ชื่อหน่วยงาน <span className="required">*</span></span><input className="control" name="name" defaultValue={organization.name} minLength={2} maxLength={255} required/></label></div><Result state={editState}/></div><div className="confirm-dialog-actions"><button className="secondary" type="button" disabled={editPending} onClick={() => editDialog.current?.close()}>ยกเลิก</button><button className="primary" disabled={editPending}>{editPending ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}</button></div></form></dialog>
    <dialog className="confirm-dialog" ref={removeDialog} aria-labelledby={removeTitleId} onCancel={(event) => { if (removePending) event.preventDefault(); }}><form action={removeAction}><div className="confirm-dialog-head"><div><strong id={removeTitleId}>ยืนยันลบหน่วยงาน</strong><small>{organization.code} — {organization.name}</small></div><button className="dialog-close" type="button" aria-label="ปิดหน้าต่าง" disabled={removePending} onClick={() => removeDialog.current?.close()}><X aria-hidden="true"/></button></div><div className="confirm-dialog-body"><input type="hidden" name="organizationUnitId" value={organization.id}/><p className="help">ระบบจะซ่อนหน่วยงานแต่ยังเก็บข้อมูลอ้างอิงย้อนหลัง หากมีหน่วยงานลูกหรือ configuration ที่ใช้งานอยู่ ระบบจะไม่อนุญาตให้ลบ</p><label className="field"><span>เหตุผลในการลบ <span className="required">*</span></span><textarea className="control" name="reason" minLength={5} maxLength={1000} required autoFocus/></label><Result state={removeState}/></div><div className="confirm-dialog-actions"><button className="secondary" type="button" disabled={removePending} onClick={() => removeDialog.current?.close()}>ยกเลิก</button><button className="danger" disabled={removePending}>{removePending ? "กำลังลบ…" : "ยืนยันการลบ"}</button></div></form></dialog>
  </div>;
}

export function AssignOrganizationApproverForm({ users, organizations }: { users: UserOption[]; organizations: OrganizationOption[] }) {
  const [state, action, pending] = useActionState(assignOrganizationApprover, initial);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <form action={action} className="card form-card"><div className="card-body"><h2>กำหนดผู้จัดการ / ผู้อนุมัติ Quotation</h2><p className="help">สร้าง ORG_UNIT role และวงเงินอนุมัติพร้อมกัน บทบาทที่เลือกต้องตรงกับ Approval Policy ที่ใช้งาน</p><div className="form-grid"><label className="field"><span>ผู้จัดการหน่วยงาน</span><select className="control" name="userId" required><option value="" disabled>เลือกผู้ใช้งาน</option>{users.map((user) => <option value={user.id} key={user.id}>{user.name} — {user.email}</option>)}</select></label><label className="field"><span>หน่วยงาน</span><select className="control" name="organizationUnitId" required><option value="" disabled>เลือกหน่วยงาน</option><OrganizationOptions organizations={organizations}/></select></label><label className="field"><span>บทบาทตาม Approval Policy</span><select className="control" name="roleCode" required><option value="" disabled>เลือกบทบาท</option>{ENTERPRISE_ROLES.map((role) => <option key={role}>{role}</option>)}</select></label><label className="field"><span>วงเงินอนุมัติสูงสุด</span><input className="control" name="maximumAmount" inputMode="decimal" pattern="\d+(\.\d{1,4})?" placeholder="0.0000" required/></label><label className="field"><span>Customer segment (ถ้ามี)</span><input className="control" name="customerSegment" maxLength={100}/></label><label className="field"><span>เริ่มมีผล</span><input className="control" type="date" name="effectiveFrom" defaultValue={today} required/></label><label className="field"><span>สิ้นสุด</span><input className="control" type="date" name="effectiveTo"/></label></div><Result state={state}/><div className="actions"><button className="primary" disabled={pending}>{pending ? "กำลังกำหนด…" : "กำหนดเป็นผู้อนุมัติ"}</button></div></div></form>;
}

export function RemoveOrganizationApproverForm({ assignmentId, managerName }: { assignmentId: string; managerName: string }) {
  const [state, action, pending] = useActionState(removeOrganizationApprover, initial);
  return <div><form action={action} onSubmit={(event) => { if (!window.confirm(`ยืนยันลบ ${managerName} ออกจากผู้อนุมัติ Quotation?`)) event.preventDefault(); }}><input type="hidden" name="assignmentId" value={assignmentId}/><button className="danger-secondary" disabled={pending}>{pending ? "กำลังลบ…" : "ลบ"}</button></form><Result state={state}/></div>;
}

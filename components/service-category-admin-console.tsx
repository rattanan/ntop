"use client";

import { Fragment, useActionState, useState } from "react";

import type { FormState } from "@/app/action-types";
import {
  createServiceCategoryAction,
  deleteServiceCategoryAction,
  updateServiceCategoryAction,
} from "@/app/actions/service-category";
import { PageNumberNavigation } from "./page-number-navigation";
import { FormNotice } from "./notice";
import { SortableTableHeader } from "./sortable-table-header";
import { Input } from "./form-field";

type Category = {
  id: string;
  version: number;
  code: string;
  name: string;
  displayOrder: number;
  requiresSiteSurvey: boolean;
  requiresBoq: boolean;
  requiresPhysicalInstallation: boolean;
  active: boolean;
  deletedAt: Date | null;
  productCount: number;
};

type Pagination = {
  page: number;
  total: number;
  totalPages: number;
  sort: "displayOrder" | "code" | "name" | "productCount" | "active";
  order: "asc" | "desc";
};
const initial: FormState = {};

function CategoryFields({ category }: { category?: Category }) {
  return <div className="form-grid">
    <label className="field"><span>รหัสหมวดหมู่</span><input className="control" name="code" required maxLength={100} defaultValue={category?.code} placeholder="เช่น CLOUD_CONNECTIVITY"/></label>
    <label className="field"><span>ชื่อหมวดหมู่</span><input className="control" name="name" required maxLength={255} defaultValue={category?.name}/></label>
    <label className="field"><span>ลำดับแสดงผล</span><Input name="displayOrder" type="number" min="0" max="100000" required defaultValue={category?.displayOrder ?? 0}/></label>
    <label className="field checkbox-field"><input name="requiresSiteSurvey" type="checkbox" defaultChecked={category?.requiresSiteSurvey}/> ต้องทำ Site Survey</label>
    <label className="field checkbox-field"><input name="requiresBoq" type="checkbox" defaultChecked={category?.requiresBoq}/> ต้องจัดทำ BOQ</label>
    <label className="field checkbox-field"><input name="requiresPhysicalInstallation" type="checkbox" defaultChecked={category?.requiresPhysicalInstallation}/> มีการติดตั้งหน้างาน</label>
    <label className="field checkbox-field"><input name="active" type="checkbox" defaultChecked={category?.active ?? true}/> เปิดใช้งาน</label>
  </div>;
}

function CreateCategoryForm() {
  const [state, action, pending] = useActionState(createServiceCategoryAction, initial);
  return <form action={action} className="card form-card service-category-create">
    <div className="card-header"><div><strong>เพิ่ม Service Category</strong><small>หมวดนี้จะใช้ร่วมกันใน Product Catalog และ Solution Design</small></div></div>
    <div className="card-body"><CategoryFields/><FormNotice state={state}/><div className="actions"><button className="primary" disabled={pending}>{pending ? "กำลังเพิ่ม…" : "เพิ่มหมวดหมู่"}</button></div></div>
  </form>;
}

function CategoryRow({ category }: { category: Category }) {
  const [editing, setEditing] = useState(false);
  const [updateState, updateAction, updating] = useActionState(updateServiceCategoryAction.bind(null, category.id), initial);
  const [deleteState, deleteAction, deleting] = useActionState(deleteServiceCategoryAction.bind(null, category.id), initial);
  const editorId = `service-category-editor-${category.id}`;
  const canDelete = !category.deletedAt && category.productCount === 0;
  return <Fragment>
    <tr className={category.deletedAt ? "is-deleted" : undefined}>
      <td>{category.displayOrder.toLocaleString("th-TH")}</td>
      <td><strong>{category.code}</strong></td>
      <td>{category.name}</td>
      <td><div className="service-category-rules" aria-label={`กฎของ ${category.name}`}><span>{category.requiresSiteSurvey ? "Survey" : "ไม่ Survey"}</span><span>{category.requiresBoq ? "BOQ" : "ไม่ BOQ"}</span><span>{category.requiresPhysicalInstallation ? "ติดตั้ง" : "ไม่ติดตั้ง"}</span></div></td>
      <td>{category.productCount.toLocaleString("th-TH")}</td>
      <td><span className={`badge ${category.active && !category.deletedAt ? "success" : "muted"}`}>{category.deletedAt ? "ลบแล้ว" : category.active ? "ใช้งาน" : "ปิดใช้งาน"}</span></td>
      <td>
        {!category.deletedAt && <div className="service-category-row-actions">
          <button type="button" className="secondary" aria-expanded={editing} aria-controls={editorId} onClick={() => setEditing((value) => !value)}>{editing ? "ปิด" : "แก้ไข"}</button>
          <form action={deleteAction} onSubmit={(event) => { if (!window.confirm(`ยืนยันลบหมวด ${category.name}? ระบบจะลบได้เมื่อไม่มี Product อ้างอิงอยู่เท่านั้น`)) event.preventDefault(); }}>
            <input type="hidden" name="expectedVersion" value={category.version}/>
            <button className="danger-secondary" disabled={deleting || !canDelete} aria-describedby={!canDelete ? `delete-help-${category.id}` : undefined}>{deleting ? "กำลังลบ…" : "ลบ"}</button>
          </form>
        </div>}
        {!category.deletedAt && !canDelete && <small id={`delete-help-${category.id}`} className="service-category-delete-help">ลบไม่ได้: มี Product อ้างอิง {category.productCount.toLocaleString("th-TH")} รายการ</small>}
        <FormNotice state={deleteState}/>
      </td>
    </tr>
    {editing && !category.deletedAt && <tr id={editorId} className="service-category-edit-row"><td colSpan={7}>
      <form action={updateAction}>
        <input type="hidden" name="expectedVersion" value={category.version}/>
        <CategoryFields category={category}/><FormNotice state={updateState}/>
        <div className="actions"><button className="primary" disabled={updating}>{updating ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}</button><button type="button" className="secondary" onClick={() => setEditing(false)}>ยกเลิก</button></div>
      </form>
    </td></tr>}
  </Fragment>;
}

export function ServiceCategoryAdminConsole({ categories, pagination }: { categories: Category[]; pagination: Pagination }) {
  return <div className="service-category-admin"><CreateCategoryForm/><section className="card" aria-labelledby="service-category-list-title">
    <div className="card-header section-heading"><div><strong id="service-category-list-title">Service Categories</strong><small>แก้ไขกฎกลางที่ควบคุม Product, Site Survey และ BOQ</small></div><span>{pagination.total.toLocaleString("th-TH")} หมวด</span></div>
    <div className="table-wrap"><table className="table service-category-table"><thead><tr>
      <SortableTableHeader basePath="/admin/service-categories" column="displayOrder" currentSort={pagination.sort} currentOrder={pagination.order} label="ลำดับ"/>
      <SortableTableHeader basePath="/admin/service-categories" column="code" currentSort={pagination.sort} currentOrder={pagination.order} label="รหัส"/>
      <SortableTableHeader basePath="/admin/service-categories" column="name" currentSort={pagination.sort} currentOrder={pagination.order} label="ชื่อหมวดหมู่"/>
      <th>กฎบริการ</th>
      <SortableTableHeader basePath="/admin/service-categories" column="productCount" currentSort={pagination.sort} currentOrder={pagination.order} label="Products"/>
      <SortableTableHeader basePath="/admin/service-categories" column="active" currentSort={pagination.sort} currentOrder={pagination.order} label="สถานะ"/>
      <th>การทำงาน</th>
    </tr></thead><tbody>{categories.map((category) => <CategoryRow key={`${category.id}-${category.version}`} category={category}/>)}</tbody></table>{!categories.length && <div className="empty">ยังไม่มี Service Category</div>}</div>
    <PageNumberNavigation ariaLabel="แบ่งหน้า Service Category" basePath="/admin/service-categories" itemCount={categories.length} page={pagination.page} params={{ sort: pagination.sort, order: pagination.order }} total={pagination.total} totalPages={pagination.totalPages} unit="หมวด"/>
  </section></div>;
}

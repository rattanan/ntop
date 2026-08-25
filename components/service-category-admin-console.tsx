"use client";

import { useActionState } from "react";

import type { FormState } from "@/app/action-types";
import {
  createServiceCategoryAction,
  deleteServiceCategoryAction,
  updateServiceCategoryAction,
} from "@/app/actions/service-category";
import { FormNotice } from "./notice";

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
};

const initial: FormState = {};

function CategoryFields({ category }: { category?: Category }) {
  return <div className="form-grid">
    <label className="field"><span>รหัสหมวดหมู่</span><input className="control" name="code" required maxLength={100} defaultValue={category?.code} placeholder="เช่น CLOUD_CONNECTIVITY"/></label>
    <label className="field"><span>ชื่อหมวดหมู่</span><input className="control" name="name" required maxLength={255} defaultValue={category?.name}/></label>
    <label className="field"><span>ลำดับแสดงผล</span><input className="control" name="displayOrder" type="number" min="0" max="100000" required defaultValue={category?.displayOrder ?? 0}/></label>
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
  const [updateState, updateAction, updating] = useActionState(updateServiceCategoryAction.bind(null, category.id), initial);
  const [deleteState, deleteAction, deleting] = useActionState(deleteServiceCategoryAction.bind(null, category.id), initial);
  return <article className={`card service-category-card${category.deletedAt ? " is-deleted" : ""}`}>
    <div className="card-header">
      <div><strong>{category.name}</strong><small>{category.code} · ลำดับ {category.displayOrder}</small></div>
      <span className={`badge ${category.active && !category.deletedAt ? "success" : "muted"}`}>{category.deletedAt ? "ลบแล้ว" : category.active ? "ใช้งาน" : "ปิดใช้งาน"}</span>
    </div>
    <div className="card-body">
      <div className="service-category-rules" aria-label="กฎของหมวดหมู่">
        <span>{category.requiresSiteSurvey ? "ต้อง Survey" : "ไม่บังคับ Survey"}</span>
        <span>{category.requiresBoq ? "ต้องทำ BOQ" : "ไม่บังคับ BOQ"}</span>
        <span>{category.requiresPhysicalInstallation ? "ติดตั้งหน้างาน" : "ไม่บังคับติดตั้ง"}</span>
      </div>
      {!category.deletedAt && <details className="service-category-editor">
        <summary className="secondary">แก้ไข</summary>
        <form action={updateAction}>
          <input type="hidden" name="expectedVersion" value={category.version}/>
          <CategoryFields category={category}/><FormNotice state={updateState}/>
          <button className="primary" disabled={updating}>{updating ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}</button>
        </form>
      </details>}
      {!category.deletedAt && <form action={deleteAction} className="service-category-delete" onSubmit={(event) => { if (!window.confirm(`ยืนยันลบหมวด ${category.name}? Product เดิมจะยังคงข้อมูลไว้`)) event.preventDefault(); }}>
        <input type="hidden" name="expectedVersion" value={category.version}/>
        <label className="field"><span>เหตุผลที่ลบ</span><input className="control" name="reason" minLength={5} maxLength={1000} required placeholder="ระบุเหตุผลเพื่อบันทึก Audit"/></label>
        <FormNotice state={deleteState}/><button className="danger-secondary" disabled={deleting}>{deleting ? "กำลังลบ…" : "ลบหมวดหมู่"}</button>
      </form>}
    </div>
  </article>;
}

export function ServiceCategoryAdminConsole({ categories }: { categories: Category[] }) {
  return <div className="service-category-admin"><CreateCategoryForm/><section aria-labelledby="service-category-list-title">
    <div className="section-heading"><div><h2 id="service-category-list-title">Service Categories</h2><p>แก้ไขกฎกลางที่ควบคุม Product, Site Survey และ BOQ</p></div><span>{categories.length} หมวด</span></div>
    <div className="service-category-grid">{categories.map((category) => <CategoryRow key={`${category.id}-${category.version}`} category={category}/>)}</div>
  </section></div>;
}

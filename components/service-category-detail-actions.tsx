"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import type { FormState } from "@/app/action-types";
import { deleteServiceCategoryAction, updateServiceCategoryAction } from "@/app/actions/service-category";
import { FormNotice } from "./notice";
import { ServiceCategoryFields, type ServiceCategoryView } from "./service-category-admin-console";

const initial: FormState = {};

export function ServiceCategoryEditForm({ category }: { category: ServiceCategoryView }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateServiceCategoryAction.bind(null, category.id), initial);
  useEffect(() => { if (state.status === "success") { router.push(`/admin/service-categories/${category.id}`);router.refresh(); } }, [category.id, router, state.status]);
  return <form action={action} className="card form-card"><input type="hidden" name="expectedVersion" value={category.version}/><div className="card-header"><div><strong>แก้ไข Service Category</strong><small>การเปลี่ยนแปลงจะ sync Product ที่อ้างอิงรหัสหรือชื่อเดิม</small></div></div><div className="card-body"><ServiceCategoryFields category={category}/><FormNotice state={state}/><div className="actions"><button className="primary" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}</button><Link className="secondary" href={`/admin/service-categories/${category.id}`}>ยกเลิก</Link></div></div></form>;
}

export function ServiceCategoryDeleteAction({ category }: { category: ServiceCategoryView }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(deleteServiceCategoryAction.bind(null, category.id), initial);
  useEffect(() => { if (state.status === "success") { router.push("/admin/service-categories");router.refresh(); } }, [router, state.status]);
  return <section className="card"><div className="card-header"><div><strong>ลบ Service Category</strong><small>ลบได้เมื่อไม่มี Product อ้างอิง และระบบจะเก็บ Audit</small></div></div><div className="card-body"><FormNotice state={state}/>{category.productCount > 0 && <p className="notice">ยังมี Product อ้างอิง {category.productCount.toLocaleString("th-TH")} รายการ จึงลบไม่ได้</p>}<form action={action} onSubmit={(event) => { if (!window.confirm(`ยืนยันลบหมวด ${category.name}?`)) event.preventDefault(); }}><input type="hidden" name="expectedVersion" value={category.version}/><button className="danger-secondary" disabled={pending || category.productCount > 0}>{pending ? "กำลังลบ…" : "ลบ Service Category"}</button></form></div></section>;
}

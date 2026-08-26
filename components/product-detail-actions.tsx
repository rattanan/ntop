"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Product = {
  id: string;
  version: number;
  code: string;
  name: string;
  category: string;
  description: string | null;
  listPrice: string;
  floorPrice: string | null;
  serviceCategoryCode: string | null;
  active: boolean;
};
type Category = {
  code: string;
  name: string;
  requiresSiteSurvey: boolean;
  requiresBoq: boolean;
  requiresPhysicalInstallation: boolean;
};

async function errorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  return payload?.error?.message ?? "ไม่สามารถบันทึก Product ได้";
}

export function ProductDeleteAction({ product }: { product: Pick<Product, "id" | "version" | "name"> }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return <section className="card">
    <div className="card-header"><div><strong>ลบ Product</strong><small>ระบบจะ Soft Delete และเก็บหลักฐาน Audit</small></div></div>
    <div className="card-body"><label className="field"><span>เหตุผลในการลบ</span><textarea className="control" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} required/></label>
      {message && <p className="notice" role="alert">{message}</p>}
      <button className="danger-secondary" disabled={pending || !reason.trim()} onClick={async () => {
        if (!window.confirm(`ยืนยันลบ Product ${product.name}?`)) return;
        setPending(true);setMessage("");
        try {
          const response = await fetch(`/api/v1/products/${product.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: product.version, reason: reason.trim() }) });
          if (!response.ok) throw new Error(await errorMessage(response));
          router.push("/products");router.refresh();
        } catch (error) { setMessage(error instanceof Error ? error.message : "ไม่สามารถลบ Product ได้"); }
        finally { setPending(false); }
      }}>{pending ? "กำลังลบ…" : "ลบ Product"}</button>
    </div>
  </section>;
}

export function ProductEditForm({ product, categories }: { product: Product; categories: Category[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  return <form className="card form-card" onSubmit={async (event) => {
    event.preventDefault();setPending(true);setMessage("");
    const form = new FormData(event.currentTarget);
    const category = categories.find((item) => item.code === String(form.get("serviceCategoryCode")));
    if (!category) { setMessage("เลือก Service Category ที่เปิดใช้งาน");setPending(false);return; }
    const body = {
      expectedVersion: product.version,
      reason: String(form.get("reason") ?? "").trim(),
      code: String(form.get("code") ?? "").trim(),
      name: String(form.get("name") ?? "").trim(),
      category: category.name,
      description: String(form.get("description") ?? "").trim() || null,
      listPrice: String(form.get("listPrice") ?? "").trim(),
      floorPrice: String(form.get("floorPrice") ?? "").trim() || null,
      serviceCategoryCode: category.code,
      requiresSiteSurvey: category.requiresSiteSurvey,
      requiresBoq: category.requiresBoq,
      requiresPhysicalInstallation: category.requiresPhysicalInstallation,
      active: form.get("active") === "on",
    };
    try {
      const response = await fetch(`/api/v1/products/${product.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(await errorMessage(response));
      router.push(`/products/${product.id}`);router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "ไม่สามารถแก้ไข Product ได้"); }
    finally { setPending(false); }
  }}>
    <div className="card-header"><div><strong>แก้ไข Product</strong><small>การเปลี่ยนแปลงใช้ optimistic version และบันทึก Audit</small></div></div>
    <div className="card-body"><div className="form-grid">
      <label className="field"><span>รหัสบริการ</span><input className="control" name="code" defaultValue={product.code} maxLength={191} required/></label>
      <label className="field"><span>ชื่อบริการ</span><input className="control" name="name" defaultValue={product.name} maxLength={255} required/></label>
      <label className="field"><span>Service Category</span><select className="control" name="serviceCategoryCode" defaultValue={product.serviceCategoryCode ?? ""} required><option value="" disabled>เลือก Service Category</option>{categories.map((category) => <option key={category.code} value={category.code}>{category.name}</option>)}</select></label>
      <label className="field"><span>List Price (บาท)</span><input className="control" name="listPrice" type="number" min="0" step="0.01" defaultValue={product.listPrice} required/></label>
      <label className="field"><span>Floor Price (บาท)</span><input className="control" name="floorPrice" type="number" min="0" step="0.0001" defaultValue={product.floorPrice ?? ""}/></label>
      <label className="field checkbox-field"><input name="active" type="checkbox" defaultChecked={product.active}/> เปิดใช้งาน</label>
      <label className="field full"><span>รายละเอียด</span><textarea className="control" name="description" rows={4} maxLength={20000} defaultValue={product.description ?? ""}/></label>
      <label className="field full"><span>เหตุผลในการแก้ไข</span><textarea className="control" name="reason" rows={3} maxLength={1000} required/></label>
    </div>{message && <p className="notice" role="alert">{message}</p>}<div className="actions"><button className="primary" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}</button><Link className="secondary" href={`/products/${product.id}`}>ยกเลิก</Link></div></div>
  </form>;
}

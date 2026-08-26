import { Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductDeleteAction } from "@/components/product-detail-actions";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS, PermissionDeniedError, permissionPolicy } from "@/lib/authorization/permission-policy";
import { prisma } from "@/lib/prisma";
import { CatalogAccessError } from "@/lib/presales/catalog-service";
import { createCatalogRuntime } from "@/lib/presales/catalog-runtime";

const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 2, maximumFractionDigits: 4 });

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const actor = { ...session, authorization };
  let product;
  try { product = await createCatalogRuntime().getProduct(actor, id); }
  catch (error) { if (error instanceof CatalogAccessError || error instanceof PermissionDeniedError) notFound(); throw error; }
  const roles = [...new Set(authorization.assignments.map((item) => item.role))];
  const configuredManage = roles.length ? await prisma.rolePermissionGrant.count({ where: { roleCode: { in: roles }, permissionCode: PERMISSIONS.productCatalogManage } }) : 0;
  const canManage = permissionPolicy.allows(session, PERMISSIONS.productCatalogManage) || configuredManage > 0;
  const category = product.serviceCategoryCode ? await prisma.serviceCategoryConfig.findUnique({ where: { code: product.serviceCategoryCode }, select: { name: true, deletedAt: true } }) : null;

  return <>
    <div className="page-head"><div><p className="eyebrow">Product · v{product.version}</p><h1>{product.name}</h1><p>{product.code} · <span className={`badge ${product.active ? "success" : "muted"}`}>{product.active ? "ใช้งาน" : "ปิดใช้งาน"}</span></p></div><div className="actions">{canManage && <Link className="secondary" href={`/products/${id}/edit`}><Pencil aria-hidden="true" />แก้ไข</Link>}<Link className="secondary" href="/products">กลับรายการ Product</Link></div></div>
    <section className="card"><div className="card-header"><div><strong>รายละเอียด Product</strong><small>อัปเดตล่าสุด {product.updatedAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</small></div></div><div className="card-body detail-grid">
      <div><p className="detail-label">Service Category</p><p className="detail-value">{category?.name ?? product.category}{category?.deletedAt ? " (ลบแล้ว)" : ""}</p></div>
      <div><p className="detail-label">Category Code</p><p className="detail-value">{product.serviceCategoryCode ?? "—"}</p></div>
      <div><p className="detail-label">List Price</p><p className="detail-value">{money.format(Number(product.listPrice))}</p></div>
      {canManage && <div><p className="detail-label">Floor Price</p><p className="detail-value">{product.floorPrice ? money.format(Number(product.floorPrice)) : "—"}</p></div>}
      {canManage && <div><p className="detail-label">Confirmed Cost</p><p className="detail-value">{product.costConfirmedAt && product.standardCost ? money.format(Number(product.standardCost)) : "ยังไม่ยืนยัน"}</p></div>}
      <div><p className="detail-label">Site Survey</p><p className="detail-value">{product.requiresSiteSurvey ? "ต้องทำ" : "ไม่ต้องทำ"}</p></div>
      <div><p className="detail-label">BOQ</p><p className="detail-value">{product.requiresBoq ? "ต้องจัดทำ" : "ไม่ต้องจัดทำ"}</p></div>
      <div><p className="detail-label">ติดตั้งหน้างาน</p><p className="detail-value">{product.requiresPhysicalInstallation ? "มี" : "ไม่มี"}</p></div>
      <div><p className="detail-label">สร้างเมื่อ</p><p className="detail-value">{product.createdAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p></div>
      <div className="full"><p className="detail-label">รายละเอียด</p><p className="detail-value">{product.description || "—"}</p></div>
    </div></section>
    {canManage && <ProductDeleteAction product={{ id: product.id, version: product.version, name: product.name }}/>} 
  </>;
}

import Link from "next/link";
import { notFound } from "next/navigation";

import { ServiceCategoryDeleteAction } from "@/components/service-category-detail-actions";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { getServiceCategory, ServiceCategoryAccessError } from "@/lib/presales/service-category-service";

export default async function ServiceCategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  let category;
  try { category = await getServiceCategory({ ...session, authorization }, id); }
  catch (error) { if (error instanceof ServiceCategoryAccessError) notFound(); throw error; }
  const deleted = Boolean(category.deletedAt);
  return <><div className="page-head"><div><p className="eyebrow">Service Category · v{category.version}</p><h1>{category.name}</h1><p>{category.code} · <span className={`badge ${category.active && !deleted ? "success" : "muted"}`}>{deleted ? "ลบแล้ว" : category.active ? "ใช้งาน" : "ปิดใช้งาน"}</span></p></div><div className="actions">{!deleted && <Link className="primary" href={`/admin/service-categories/${id}/edit`}>แก้ไข</Link>}<Link className="secondary" href="/admin/service-categories">กลับรายการ Service Category</Link></div></div>
    <section className="card"><div className="card-header"><div><strong>รายละเอียด Service Category</strong><small>อัปเดตล่าสุด {category.updatedAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</small></div></div><div className="card-body detail-grid">
      <div><p className="detail-label">ลำดับแสดงผล</p><p className="detail-value">{category.displayOrder.toLocaleString("th-TH")}</p></div>
      <div><p className="detail-label">Products</p><p className="detail-value">{category.productCount.toLocaleString("th-TH")} รายการ</p></div>
      <div><p className="detail-label">Site Survey</p><p className="detail-value">{category.requiresSiteSurvey ? "ต้องทำ" : "ไม่ต้องทำ"}</p></div>
      <div><p className="detail-label">BOQ</p><p className="detail-value">{category.requiresBoq ? "ต้องจัดทำ" : "ไม่ต้องจัดทำ"}</p></div>
      <div><p className="detail-label">ติดตั้งหน้างาน</p><p className="detail-value">{category.requiresPhysicalInstallation ? "มี" : "ไม่มี"}</p></div>
      <div><p className="detail-label">สร้างเมื่อ</p><p className="detail-value">{category.createdAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p></div>
      {category.deletedAt && <div><p className="detail-label">ลบเมื่อ</p><p className="detail-value">{category.deletedAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p></div>}
    </div></section>
    {!deleted && <ServiceCategoryDeleteAction category={category}/>} 
  </>;
}

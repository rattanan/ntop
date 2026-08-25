import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS, permissionPolicy } from "@/lib/authorization/permission-policy";

const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 2, maximumFractionDigits: 4 });

export default async function Products() {
  const session = await requireSession();
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const roles = [...new Set(authorization.assignments.map((item) => item.role))];
  const [products, categories, configuredManage] = await Promise.all([
    prisma.product.findMany({ where: { deletedAt: null }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.serviceCategoryConfig.findMany({ select: { code: true, name: true }, orderBy: { displayOrder: "asc" } }),
    roles.length ? prisma.rolePermissionGrant.count({ where: { roleCode: { in: roles }, permissionCode: PERMISSIONS.productCatalogManage } }) : Promise.resolve(0),
  ]);
  const canManage = permissionPolicy.allows(session, PERMISSIONS.productCatalogManage) || configuredManage > 0;
  const categoryNames = new Map(categories.map((category) => [category.code, category.name]));
  return <><div className="page-head"><div><p className="eyebrow">Product Catalog</p><h1>บริการและโซลูชัน NT</h1><p>Catalog item ทุกชิ้นเชื่อมกับ Service Category กลาง</p></div>{canManage && <div className="actions"><Link href="/admin/service-categories" className="secondary">จัดการหมวดหมู่</Link><Link href="/products/new" className="primary">เพิ่มบริการ</Link></div>}</div><section className="card"><div className="table-wrap"><table className="table"><thead><tr><th>รหัส</th><th>บริการ</th><th>Service Category</th><th>List Price</th><th>Floor Price</th><th>Confirmed Cost</th><th>สถานะ</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{product.code}</td><td><strong>{product.name}</strong><br/><small>{product.description || "—"}</small></td><td><span className="badge">{product.serviceCategoryCode ? categoryNames.get(product.serviceCategoryCode) ?? product.category : product.category}</span>{product.serviceCategoryCode && <><br/><small>{product.serviceCategoryCode}</small></>}</td><td>{money.format(Number(product.listPrice))}</td><td>{product.floorPrice ? money.format(Number(product.floorPrice)) : <span className="badge muted">ยังไม่กำหนด</span>}</td><td>{product.costConfirmedAt && product.standardCost ? money.format(Number(product.standardCost)) : <span className="badge muted">ยังไม่ยืนยัน</span>}</td><td>{product.active ? "ใช้งาน" : "ปิดใช้งาน"}</td></tr>)}</tbody></table>{!products.length && <div className="empty">ยังไม่มีบริการใน Catalog — ผู้ดูแลระบบสามารถเพิ่ม Internet, MPLS, SD-WAN, Cloud และบริการอื่นได้</div>}</div></section></>;
}

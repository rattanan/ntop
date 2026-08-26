import type { Prisma } from "@prisma/client";
import { Eye } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageNumberNavigation } from "@/components/page-number-navigation";
import { SortableTableHeader } from "@/components/sortable-table-header";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS, permissionPolicy } from "@/lib/authorization/permission-policy";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;
const PRODUCT_SORTS = ["code", "name", "category", "listPrice", "floorPrice", "standardCost", "active"] as const;
type ProductSort = typeof PRODUCT_SORTS[number];
type Search = { q?: string; page?: string; sort?: string; order?: string };

const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 2, maximumFractionDigits: 4 });

function productSort(value: string | undefined): ProductSort {
  return PRODUCT_SORTS.includes(value as ProductSort) ? value as ProductSort : "code";
}

export default async function Products({ searchParams }: { searchParams: Promise<Search> }) {
  const query = await searchParams;
  const session = await requireSession();
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const roles = [...new Set(authorization.assignments.map((item) => item.role))];
  const q = query.q?.trim().slice(0, 100) ?? "";
  const sort = productSort(query.sort);
  const order: "asc" | "desc" = query.order === "desc" ? "desc" : "asc";
  const baseWhere: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(q ? { OR: [
      { code: { contains: q } },
      { name: { contains: q } },
      { category: { contains: q } },
      { serviceCategoryCode: { contains: q } },
      { description: { contains: q } },
    ] } : {}),
  };
  const [configuredManage, configuredView] = await Promise.all([
    roles.length ? prisma.rolePermissionGrant.count({ where: { roleCode: { in: roles }, permissionCode: PERMISSIONS.productCatalogManage } }) : Promise.resolve(0),
    roles.length ? prisma.rolePermissionGrant.count({ where: { roleCode: { in: roles }, permissionCode: PERMISSIONS.productCatalogView } }) : Promise.resolve(0),
  ]);
  const canView = permissionPolicy.allows(session, PERMISSIONS.productCatalogView) || configuredView > 0 || configuredManage > 0;
  if (!canView) notFound();
  const total = await prisma.product.count({ where: baseWhere });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const products = await prisma.product.findMany({
    where: baseWhere,
    orderBy: [{ [sort]: order }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const categoryCodes = [...new Set(products.map((product) => product.serviceCategoryCode).filter((code): code is string => Boolean(code)))];
  const categories = categoryCodes.length ? await prisma.serviceCategoryConfig.findMany({
    where: { code: { in: categoryCodes } },
    select: { code: true, name: true },
  }) : [];
  const canManage = permissionPolicy.allows(session, PERMISSIONS.productCatalogManage) || configuredManage > 0;
  const categoryNames = new Map(categories.map((category) => [category.code, category.name]));
  const listParams = { ...(q ? { q } : {}), sort, order };
  const sortParams: Record<string, string> = q ? { q } : {};

  return <>
    <div className="page-head"><div><p className="eyebrow">Product Catalog</p><h1>บริการและโซลูชัน NT</h1><p>{total.toLocaleString("th-TH")} รายการ{q ? ` สำหรับ “${q}”` : "ใน Catalog"}</p></div>{canManage && <div className="actions"><Link href="/admin/service-categories" className="secondary">จัดการหมวดหมู่</Link><Link href="/products/new" className="primary">เพิ่มบริการ</Link></div>}</div>
    <section className="card">
      <form method="get" className="table-tools" role="search" aria-label="ค้นหา Product">
        <input type="hidden" name="sort" value={sort}/><input type="hidden" name="order" value={order}/>
        <label className="field product-search-field"><span>ค้นหา Product</span><input className="control search" name="q" maxLength={100} defaultValue={q} placeholder="รหัส ชื่อบริการ หมวดหมู่ หรือรายละเอียด"/></label>
        <button className="secondary">ค้นหา</button>
        {q && <Link className="secondary" href={`/products?sort=${sort}&order=${order}`}>ล้างการค้นหา</Link>}
      </form>
      <div className="table-wrap"><table className="table"><thead><tr>
        <SortableTableHeader basePath="/products" column="code" currentSort={sort} currentOrder={order} label="รหัส" params={sortParams}/>
        <SortableTableHeader basePath="/products" column="name" currentSort={sort} currentOrder={order} label="บริการ" params={sortParams}/>
        <SortableTableHeader basePath="/products" column="category" currentSort={sort} currentOrder={order} label="Service Category" params={sortParams}/>
        <SortableTableHeader basePath="/products" column="listPrice" currentSort={sort} currentOrder={order} label="List Price" params={sortParams}/>
        <SortableTableHeader basePath="/products" column="floorPrice" currentSort={sort} currentOrder={order} label="Floor Price" params={sortParams}/>
        <SortableTableHeader basePath="/products" column="standardCost" currentSort={sort} currentOrder={order} label="Confirmed Cost" params={sortParams}/>
        <SortableTableHeader basePath="/products" column="active" currentSort={sort} currentOrder={order} label="สถานะ" params={sortParams}/>
        <th>การทำงาน</th>
      </tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{product.code}</td><td><strong>{product.name}</strong><br/><small>{product.description || "—"}</small></td><td><span className="badge">{product.serviceCategoryCode ? categoryNames.get(product.serviceCategoryCode) ?? product.category : product.category}</span>{product.serviceCategoryCode && <><br/><small>{product.serviceCategoryCode}</small></>}</td><td>{money.format(Number(product.listPrice))}</td><td>{product.floorPrice ? money.format(Number(product.floorPrice)) : <span className="badge muted">ยังไม่กำหนด</span>}</td><td>{product.costConfirmedAt && product.standardCost ? money.format(Number(product.standardCost)) : <span className="badge muted">ยังไม่ยืนยัน</span>}</td><td>{product.active ? "ใช้งาน" : "ปิดใช้งาน"}</td><td><Link className="row-action" href={`/products/${product.id}`} aria-label={`ดู Product ${product.name}`}><Eye aria-hidden="true" />ดู</Link></td></tr>)}</tbody></table>{!products.length && <div className="empty">{q ? "ไม่พบ Product ที่ตรงกับคำค้นหา" : "ยังไม่มีบริการใน Catalog — ผู้ดูแลระบบสามารถเพิ่มบริการใหม่ได้"}</div>}</div>
      <PageNumberNavigation ariaLabel="แบ่งหน้า Product" basePath="/products" itemCount={products.length} page={page} params={listParams} total={total} totalPages={totalPages} unit="รายการ"/>
    </section>
  </>;
}

import type { Prisma } from "@prisma/client";
import Link from "next/link";

import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS, permissionPolicy } from "@/lib/authorization/permission-policy";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;
const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 2, maximumFractionDigits: 4 });

type Search = { q?: string; cursor?: string; direction?: string; page?: string };

export default async function Products({ searchParams }: { searchParams: Promise<Search> }) {
  const query = await searchParams;
  const session = await requireSession();
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const roles = [...new Set(authorization.assignments.map((item) => item.role))];
  const q = query.q?.trim().slice(0, 100) ?? "";
  const requestedPage = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const direction = query.direction === "prev" ? "prev" : "next";
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
  const anchor = query.cursor ? await prisma.product.findFirst({
    where: { id: query.cursor, ...baseWhere },
    select: { id: true, code: true },
  }) : null;
  const cursorWhere: Prisma.ProductWhereInput = anchor ? {
    OR: direction === "prev"
      ? [{ code: { lt: anchor.code } }, { code: anchor.code, id: { lt: anchor.id } }]
      : [{ code: { gt: anchor.code } }, { code: anchor.code, id: { gt: anchor.id } }],
  } : {};
  const [rawProducts, total, configuredManage] = await Promise.all([
    prisma.product.findMany({
      where: { AND: [baseWhere, cursorWhere] },
      orderBy: direction === "prev" && anchor
        ? [{ code: "desc" }, { id: "desc" }]
        : [{ code: "asc" }, { id: "asc" }],
      take: PAGE_SIZE + 1,
    }),
    prisma.product.count({ where: baseWhere }),
    roles.length ? prisma.rolePermissionGrant.count({ where: { roleCode: { in: roles }, permissionCode: PERMISSIONS.productCatalogManage } }) : Promise.resolve(0),
  ]);
  const hasExtra = rawProducts.length > PAGE_SIZE;
  const pageProducts = rawProducts.slice(0, PAGE_SIZE);
  const products = direction === "prev" && anchor ? pageProducts.reverse() : pageProducts;
  const cursorApplied = Boolean(anchor);
  const page = cursorApplied ? requestedPage : 1;
  const hasPrevious = direction === "prev" && cursorApplied ? hasExtra : cursorApplied;
  const hasNext = direction === "prev" && cursorApplied ? true : hasExtra;
  const categoryCodes = [...new Set(products.map((product) => product.serviceCategoryCode).filter((code): code is string => Boolean(code)))];
  const categories = categoryCodes.length ? await prisma.serviceCategoryConfig.findMany({
    where: { code: { in: categoryCodes } },
    select: { code: true, name: true },
  }) : [];
  const canManage = permissionPolicy.allows(session, PERMISSIONS.productCatalogManage) || configuredManage > 0;
  const categoryNames = new Map(categories.map((category) => [category.code, category.name]));
  const href = (nextDirection: "prev" | "next", cursor: string, nextPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("cursor", cursor);
    params.set("direction", nextDirection);
    params.set("page", String(nextPage));
    return `/products?${params.toString()}`;
  };

  return <>
    <div className="page-head"><div><p className="eyebrow">Product Catalog</p><h1>บริการและโซลูชัน NT</h1><p>{total.toLocaleString("th-TH")} รายการ{q ? ` สำหรับ “${q}”` : "ใน Catalog"}</p></div>{canManage && <div className="actions"><Link href="/admin/service-categories" className="secondary">จัดการหมวดหมู่</Link><Link href="/products/new" className="primary">เพิ่มบริการ</Link></div>}</div>
    <section className="card">
      <form method="get" className="table-tools" role="search" aria-label="ค้นหา Product">
        <label className="field product-search-field"><span>ค้นหา Product</span><input className="control search" name="q" maxLength={100} defaultValue={q} placeholder="รหัส ชื่อบริการ หมวดหมู่ หรือรายละเอียด"/></label>
        <button className="secondary">ค้นหา</button>
        {q && <Link className="secondary" href="/products">ล้างการค้นหา</Link>}
      </form>
      <div className="table-wrap"><table className="table"><thead><tr><th>รหัส</th><th>บริการ</th><th>Service Category</th><th>List Price</th><th>Floor Price</th><th>Confirmed Cost</th><th>สถานะ</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{product.code}</td><td><strong>{product.name}</strong><br/><small>{product.description || "—"}</small></td><td><span className="badge">{product.serviceCategoryCode ? categoryNames.get(product.serviceCategoryCode) ?? product.category : product.category}</span>{product.serviceCategoryCode && <><br/><small>{product.serviceCategoryCode}</small></>}</td><td>{money.format(Number(product.listPrice))}</td><td>{product.floorPrice ? money.format(Number(product.floorPrice)) : <span className="badge muted">ยังไม่กำหนด</span>}</td><td>{product.costConfirmedAt && product.standardCost ? money.format(Number(product.standardCost)) : <span className="badge muted">ยังไม่ยืนยัน</span>}</td><td>{product.active ? "ใช้งาน" : "ปิดใช้งาน"}</td></tr>)}</tbody></table>{!products.length && <div className="empty">{q ? "ไม่พบ Product ที่ตรงกับคำค้นหา" : "ยังไม่มีบริการใน Catalog — ผู้ดูแลระบบสามารถเพิ่มบริการใหม่ได้"}</div>}</div>
      <nav className="card-body actions table-pagination" aria-label="แบ่งหน้า Product"><span>หน้า {page} · แสดง {products.length.toLocaleString("th-TH")} จาก {total.toLocaleString("th-TH")} รายการ</span>{hasPrevious && products[0] && <Link className="secondary" href={href("prev", products[0].id, Math.max(1, page - 1))} rel="prev">ก่อนหน้า</Link>}{hasNext && products.at(-1) && <Link className="secondary" href={href("next", products.at(-1)!.id, page + 1)} rel="next">ถัดไป</Link>}</nav>
    </section>
  </>;
}

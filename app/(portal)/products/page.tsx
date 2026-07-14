import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 2, maximumFractionDigits: 4 });

export default async function Products() {
  const session = await requireSession(); const products = await prisma.product.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  return <><div className="page-head"><div><p className="eyebrow">Product Catalog</p><h1>บริการและโซลูชัน NT</h1></div>{session.role === "ADMIN" && <Link href="/products/new" className="primary">เพิ่มบริการ</Link>}</div><section className="card"><div className="table-wrap"><table className="table"><thead><tr><th>รหัส</th><th>บริการ</th><th>หมวดหมู่</th><th>List Price</th><th>Floor Price</th><th>Confirmed Cost</th><th>สถานะ</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{product.code}</td><td><strong>{product.name}</strong><br/><small>{product.description || "—"}</small></td><td><span className="badge">{product.category}</span></td><td>{money.format(Number(product.listPrice))}</td><td>{product.floorPrice ? money.format(Number(product.floorPrice)) : <span className="badge muted">ยังไม่กำหนด</span>}</td><td>{product.costConfirmedAt && product.standardCost ? money.format(Number(product.standardCost)) : <span className="badge muted">ยังไม่ยืนยัน</span>}</td><td>{product.active ? "ใช้งาน" : "ปิดใช้งาน"}</td></tr>)}</tbody></table>{!products.length && <div className="empty">ยังไม่มีบริการใน Catalog — ผู้ดูแลระบบสามารถเพิ่ม Internet, MPLS, SD-WAN, Cloud และบริการอื่นได้</div>}</div></section></>;
}

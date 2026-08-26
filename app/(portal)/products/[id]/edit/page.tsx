import { notFound } from "next/navigation";

import { ProductEditForm } from "@/components/product-detail-actions";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS, permissionPolicy } from "@/lib/authorization/permission-policy";
import { prisma } from "@/lib/prisma";

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const roles = [...new Set(authorization.assignments.map((item) => item.role))];
  const configuredManage = roles.length ? await prisma.rolePermissionGrant.count({ where: { roleCode: { in: roles }, permissionCode: PERMISSIONS.productCatalogManage } }) : 0;
  if (!permissionPolicy.allows(session, PERMISSIONS.productCatalogManage) && !configuredManage) notFound();
  const [product, categories] = await Promise.all([
    prisma.product.findFirst({ where: { id, deletedAt: null } }),
    prisma.serviceCategoryConfig.findMany({ where: { active: true, deletedAt: null }, select: { code: true, name: true, requiresSiteSurvey: true, requiresBoq: true, requiresPhysicalInstallation: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
  ]);
  if (!product) notFound();
  return <><div className="page-head"><div><p className="eyebrow">{product.code} · v{product.version}</p><h1>แก้ไข Product</h1><p>เลือก Service Category เพื่อ sync กฎ Survey, BOQ และการติดตั้ง</p></div></div><ProductEditForm product={{ id: product.id, version: product.version, code: product.code, name: product.name, category: product.category, description: product.description, listPrice: product.listPrice.toString(), floorPrice: product.floorPrice?.toString() ?? null, serviceCategoryCode: product.serviceCategoryCode, active: product.active }} categories={categories}/></>;
}

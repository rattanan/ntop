import { ProductForm } from "@/components/forms";
import { requireSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { PERMISSIONS, permissionPolicy } from "@/lib/authorization/permission-policy";
export default async function NewProduct(){const s=await requireSession();const authorization=await loadAuthorizationContext({actorId:s.id,legacyRole:s.role});const roles=[...new Set(authorization.assignments.map(item=>item.role))];const allowed=permissionPolicy.allows(s,PERMISSIONS.productCatalogManage)||(roles.length>0&&await prisma.rolePermissionGrant.count({where:{roleCode:{in:roles},permissionCode:PERMISSIONS.productCatalogManage}})>0);if(!allowed)redirect("/products");const categories=await prisma.serviceCategoryConfig.findMany({where:{active:true},select:{code:true,name:true,requiresSiteSurvey:true,requiresBoq:true},orderBy:[{displayOrder:"asc"},{name:"asc"}]});return <><div className="page-head"><div><p className="eyebrow">Product Catalog</p><h1>เพิ่มบริการใหม่</h1><p>เลือกหมวดจาก Service Category กลางเพื่อใช้กฎเดียวกับ Solution Design, Survey และ BOQ</p></div></div><ProductForm categories={categories}/></>}

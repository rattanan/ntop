import { notFound } from "next/navigation";

import { ServiceCategoryAdminConsole } from "@/components/service-category-admin-console";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { listServiceCategories, ServiceCategoryAccessError } from "@/lib/presales/service-category-service";

export default async function ServiceCategoriesPage() {
  const session = await requireSession();
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  let categories;
  try {
    categories = await listServiceCategories({ ...session, authorization });
  } catch (error) {
    if (error instanceof ServiceCategoryAccessError) notFound();
    throw error;
  }
  return <>
    <div className="page-head"><div><p className="eyebrow">Catalog Administration</p><h1>จัดการ Service Category</h1><p>กำหนดหมวดบริการและกฎ Site Survey, BOQ และการติดตั้งจากจุดเดียว</p></div></div>
    <ServiceCategoryAdminConsole categories={categories}/>
  </>;
}

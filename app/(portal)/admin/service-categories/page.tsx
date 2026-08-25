import { notFound } from "next/navigation";

import { ServiceCategoryAdminConsole } from "@/components/service-category-admin-console";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import {
  listServiceCategories,
  SERVICE_CATEGORY_SORTS,
  ServiceCategoryAccessError,
  type ServiceCategorySort,
} from "@/lib/presales/service-category-service";

const PAGE_SIZE = 10;
type Search = { page?: string; sort?: string; order?: string };

export default async function ServiceCategoriesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const query = await searchParams;
  const session = await requireSession();
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const requestedPage = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const sort = SERVICE_CATEGORY_SORTS.includes(query.sort as ServiceCategorySort) ? query.sort as ServiceCategorySort : "displayOrder";
  const order: "asc" | "desc" = query.order === "desc" ? "desc" : "asc";
  let result;
  try {
    result = await listServiceCategories({ ...session, authorization }, {
      page: requestedPage,
      limit: PAGE_SIZE,
      sort,
      order,
    });
  } catch (error) {
    if (error instanceof ServiceCategoryAccessError) notFound();
    throw error;
  }
  return <>
    <div className="page-head"><div><p className="eyebrow">Catalog Administration</p><h1>จัดการ Service Category</h1><p>กำหนดหมวดบริการและกฎ Site Survey, BOQ และการติดตั้งจากจุดเดียว</p></div></div>
    <ServiceCategoryAdminConsole categories={result.items} pagination={{
      page: result.page,
      total: result.total,
      totalPages: result.totalPages,
      sort: result.sort,
      order: result.order,
    }}/>
  </>;
}

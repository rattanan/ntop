import { notFound } from "next/navigation";

import { ServiceCategoryAdminConsole } from "@/components/service-category-admin-console";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { listServiceCategories, ServiceCategoryAccessError } from "@/lib/presales/service-category-service";

const PAGE_SIZE = 10;
type Search = { cursor?: string; direction?: string; page?: string };

export default async function ServiceCategoriesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const query = await searchParams;
  const session = await requireSession();
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const requestedPage = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  let result;
  try {
    result = await listServiceCategories({ ...session, authorization }, {
      cursor: query.cursor,
      direction: query.direction === "prev" ? "prev" : "next",
      limit: PAGE_SIZE,
    });
  } catch (error) {
    if (error instanceof ServiceCategoryAccessError) notFound();
    throw error;
  }
  const page = result.cursorApplied ? requestedPage : 1;
  const href = (direction: "prev" | "next", cursor: string, nextPage: number) => {
    const params = new URLSearchParams({ direction, cursor, page: String(nextPage) });
    return `/admin/service-categories?${params.toString()}`;
  };
  return <>
    <div className="page-head"><div><p className="eyebrow">Catalog Administration</p><h1>จัดการ Service Category</h1><p>กำหนดหมวดบริการและกฎ Site Survey, BOQ และการติดตั้งจากจุดเดียว</p></div></div>
    <ServiceCategoryAdminConsole categories={result.items} pagination={{
      page,
      total: result.total,
      previousHref: result.hasPrevious && result.items[0] ? href("prev", result.items[0].id, Math.max(1, page - 1)) : null,
      nextHref: result.hasNext && result.items.at(-1) ? href("next", result.items.at(-1)!.id, page + 1) : null,
    }}/>
  </>;
}

import { notFound } from "next/navigation";

import { ServiceCategoryEditForm } from "@/components/service-category-detail-actions";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
import { getServiceCategory, ServiceCategoryAccessError } from "@/lib/presales/service-category-service";

export default async function ServiceCategoryEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  let category;
  try { category = await getServiceCategory({ ...session, authorization }, id); }
  catch (error) { if (error instanceof ServiceCategoryAccessError) notFound(); throw error; }
  if (category.deletedAt) notFound();
  return <><div className="page-head"><div><p className="eyebrow">{category.code} · v{category.version}</p><h1>แก้ไข Service Category</h1><p>ปรับชื่อ กฎบริการ สถานะ และลำดับแสดงผล</p></div></div><ServiceCategoryEditForm category={category}/></>;
}

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext, loadGrantedPermissions } from "@/lib/authorization/authorization-context";
import { parseDashboardFilters } from "@/lib/dashboard/dashboard-filters";
import { DashboardAccessError, loadDashboardData, type DashboardData } from "@/lib/dashboard/dashboard-query";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const authorization = await loadAuthorizationContext({ actorId: session.id, legacyRole: session.role });
  const grantedPermissions = await loadGrantedPermissions(authorization);
  const filters = parseDashboardFilters(await searchParams);
  let data: DashboardData | null = null;
  let denied = false;
  try {
    data = await loadDashboardData({ id: session.id, authorization, grantedPermissions }, filters);
  } catch (error) {
    if (error instanceof DashboardAccessError) {
      denied = true;
    } else {
      throw error;
    }
  }
  if (denied || !data) return <section className="dashboard-state dashboard-denied" data-testid="dashboard-permission-denied" role="alert">
    <span className="dashboard-state-code">403</span>
    <h1>ไม่มีสิทธิ์เข้าถึง Dashboard นี้</h1>
    <p>บัญชีของคุณยังไม่ได้รับสิทธิ์ Dashboard หรือ filter ที่เลือกอยู่นอกขอบเขตหน่วยงานที่ได้รับมอบหมาย</p>
    <a className="secondary" href="/dashboard">กลับสู่ขอบเขตที่ได้รับอนุญาต</a>
  </section>;
  return <DashboardView data={data} userName={session.name}/>;
}

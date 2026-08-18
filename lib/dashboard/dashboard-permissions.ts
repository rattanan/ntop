export const DASHBOARD_PERMISSIONS = {
  view: "dashboard.view",
  export: "dashboard.export",
  executive: "dashboard.section.executive",
  sales: "dashboard.section.sales",
  salesManager: "dashboard.section.sales-manager",
  solution: "dashboard.section.solution",
  approver: "dashboard.section.approver",
  operations: "dashboard.section.operations",
  customerSuccess: "dashboard.section.customer-success",
  admin: "dashboard.section.admin",
} as const;

export type DashboardSection = Exclude<keyof typeof DASHBOARD_PERMISSIONS, "view" | "export">;

export function visibleDashboardSections(grantedPermissions: Iterable<string>): DashboardSection[] {
  const granted = new Set(grantedPermissions);
  return (Object.keys(DASHBOARD_PERMISSIONS) as Array<keyof typeof DASHBOARD_PERMISSIONS>)
    .filter((key): key is DashboardSection => key !== "view" && key !== "export")
    .filter((key) => granted.has(DASHBOARD_PERMISSIONS[key]));
}

export function canViewDashboard(grantedPermissions: Iterable<string>) {
  return new Set(grantedPermissions).has(DASHBOARD_PERMISSIONS.view);
}

export function canExportDashboard(grantedPermissions: Iterable<string>) {
  return new Set(grantedPermissions).has(DASHBOARD_PERMISSIONS.export);
}

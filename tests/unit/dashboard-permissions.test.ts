import { describe, expect, it } from "vitest";

import { DASHBOARD_PERMISSIONS, canExportDashboard, canViewDashboard, visibleDashboardSections } from "../../lib/dashboard/dashboard-permissions";

describe("dashboard permissions", () => {
  it("derives role focus only from granted permission codes", () => {
    const grants = [DASHBOARD_PERMISSIONS.view, DASHBOARD_PERMISSIONS.sales, DASHBOARD_PERMISSIONS.solution];
    expect(canViewDashboard(grants)).toBe(true);
    expect(canExportDashboard(grants)).toBe(false);
    expect(visibleDashboardSections(grants)).toEqual(["sales", "solution"]);
  });

  it("does not infer access from a role name", () => {
    expect(canViewDashboard(["ADMIN", "KAM"])).toBe(false);
    expect(visibleDashboardSections(["EXECUTIVE"])).toEqual([]);
  });
});

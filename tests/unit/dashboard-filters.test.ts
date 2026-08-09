import { describe, expect, it } from "vitest";

import { DashboardFilterError, dashboardDateRange, dashboardFilterSearchParams, parseDashboardFilters } from "../../lib/dashboard/dashboard-filters";

describe("dashboard filters", () => {
  it("accepts the seven global dimensions and preserves Bangkok date boundaries", () => {
    const filters = parseDashboardFilters({ from: "2026-08-01", to: "2026-08-31", departmentId: "d1", teamId: "t1", ownerId: "u1", segment: "G1", productId: "p1", status: "QUALIFY" });
    expect(dashboardFilterSearchParams(filters).get("ownerId")).toBe("u1");
    const range = dashboardDateRange(filters);
    expect(range.from?.toISOString()).toBe("2026-07-31T17:00:00.000Z");
    expect(range.to?.toISOString()).toBe("2026-08-31T16:59:59.999Z");
  });

  it("rejects invalid and reversed date ranges", () => {
    expect(() => parseDashboardFilters({ from: "invalid" })).toThrow(DashboardFilterError);
    expect(() => parseDashboardFilters({ from: "2026-09-01", to: "2026-08-01" })).toThrow(DashboardFilterError);
  });
});

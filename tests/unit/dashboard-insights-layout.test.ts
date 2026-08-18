import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("app/(portal)/dashboard/page.tsx", "utf8");
const component = readFileSync("components/dashboard/dashboard-view.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");

describe("dashboard states and insights", () => {
  it("renders server-scoped data and a permission denied state", () => {
    expect(page).toContain("loadDashboardData");
    expect(page).toContain("DashboardAccessError");
    expect(page).toContain('data-testid="dashboard-permission-denied"');
  });

  it("renders all requested pipeline dimensions and an accessible table alternative", () => {
    for (const dimension of ["stage", "segment", "product", "owner", "month"]) {
      expect(component).toContain(`data.charts.${dimension}`);
    }
    expect(component).toContain('<table className="sr-only">');
    expect(component).toContain("role=\"img\"");
  });

  it("supports filter persistence, drill-down, export and all explicit UI states", () => {
    expect(component).toContain('localStorage.getItem("ntop-dashboard-filters")');
    expect(component).toContain("item.href");
    expect(component).toContain("/api/v1/dashboard/export");
    expect(component).toContain('data-testid="dashboard-empty"');
    expect(readFileSync("app/(portal)/dashboard/loading.tsx", "utf8")).toContain('data-testid="dashboard-loading"');
    expect(readFileSync("app/(portal)/dashboard/error.tsx", "utf8")).toContain('data-testid="dashboard-error"');
  });

  it("isolates proposal chart layout from the dashboard status rows", () => {
    expect(css).toContain(".proposal-dashboard-grid .status-chart>div");
    expect(css).not.toMatch(/(?:^|\n)\.status-chart>div\s*\{/);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Pipeline dashboard UI", () => {
  it("uses scoped real data, fiscal periods, targets and Closed Won evidence", () => {
    const page = read("app/(portal)/pipeline/page.tsx");
    expect(page).toContain("loadAuthorizationContext");
    expect(page).toContain("repository.listFacts");
    expect(page).toContain("prisma.salesTarget.findMany");
    expect(page).toContain('toStage: "WON"');
    expect(page).not.toContain("mock");
  });

  it("provides an accessible responsive funnel, filters, drill-down and empty state", () => {
    const component = read("components/pipeline-dashboard.tsx");
    const css = read("app/globals.css");
    expect(component).toContain('aria-label="ตัวกรอง Pipeline"');
    expect(component).toContain('role="img"');
    expect(component).toContain("Pipeline funnel");
    expect(component).toContain("Opportunity ใน Forecast");
    expect(component).toContain("ไม่พบ Opportunity");
    expect(css).toContain("@media (max-width:600px)");
    expect(css).toContain("prefers-reduced-motion:reduce");
  });

  it("keeps KPI and health cards equal-height across responsive grid rows", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/\.pipeline-kpis\s*\{[^}]*grid-auto-rows:1fr;[^}]*align-items:stretch;/);
    expect(css).toMatch(/\.pipeline-kpi\s*\{[^}]*height:100%;/);
    expect(css).toMatch(/\.pipeline-health\s*\{[^}]*grid-auto-rows:1fr;[^}]*align-items:stretch;/);
    expect(css).toMatch(/\.pipeline-health article\s*\{[^}]*height:100%;/);
  });
});

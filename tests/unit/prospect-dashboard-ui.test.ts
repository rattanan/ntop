import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Prospect dashboard UI", () => {
  it("keeps authorization-scoped real data and all existing KPI destinations", () => {
    const page = read("app/(portal)/prospects/dashboard/page.tsx");
    expect(page).toContain("loadAuthorizationContext");
    expect(page).toContain("buildProspectScopeWhere");
    expect(page).toContain("Promise.all");
    expect(page).not.toContain("mock");
    for (const destination of ["/prospects", "status=NEW", "status=CONTACTED", "status=INTERESTED", "status=QUALIFIED", "status=CONVERTED", "status=LOST", "overdue=1"]) {
      expect(page).toContain(destination);
    }
  });

  it("renders accessible status, conversion and score visualizations with empty states", () => {
    const page = read("app/(portal)/prospects/dashboard/page.tsx");
    expect(page).toContain("Prospect by Status");
    expect(page).toContain("Top Hot Prospects");
    expect(page).toContain('role="img"');
    expect(page).toContain("<progress");
    expect(page).toContain("คิดเป็น ${percentage}%");
    expect(page).toContain("score ${score} จาก 100");
    expect(page).toContain("ยังไม่มีข้อมูล Prospect");
    expect(page).toContain("ยังไม่มี Hot Prospect");
  });

  it("uses equal-height responsive dashboard grids", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/\.prospect-kpi-grid\s*\{[^}]*grid-auto-rows:1fr;/);
    expect(css).toMatch(/\.prospect-chart-grid\s*\{[^}]*align-items:stretch;/);
    expect(css).toContain("@media (max-width:900px) { .prospect-dashboard-hero,.prospect-chart-grid { grid-template-columns:1fr; }");
    expect(css).toContain("@media (max-width:600px) { .prospect-dashboard-head");
    expect(css).toContain("prefers-reduced-motion:reduce");
  });
});

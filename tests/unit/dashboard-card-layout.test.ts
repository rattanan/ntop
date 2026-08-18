import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app/dashboard.css"), "utf8");

describe("enterprise dashboard layout", () => {
  it("uses equal-height responsive KPI cards without horizontal mobile overflow", () => {
    expect(css).toContain(".dashboard-kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));");
    expect(css).toContain(".dashboard-metric-card{position:relative;min-width:0;min-height:126px;");
    expect(css).toContain("@media (max-width:900px)");
    expect(css).toContain(".dashboard-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}");
    expect(css).toContain("@media (max-width:600px)");
    expect(css).toContain(".dashboard-filter-grid,.dashboard-kpi-grid{grid-template-columns:1fr}");
  });

  it("defines paired dark tokens and reduced-motion behavior", () => {
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain("--background:#111318");
    expect(css).toContain("@media (prefers-reduced-motion:reduce)");
  });
});

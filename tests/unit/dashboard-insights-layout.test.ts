import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("app/(portal)/dashboard/page.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");

describe("dashboard insight panels", () => {
  it("renders status data as an accessible dynamic chart", () => {
    expect(page).toContain("statuses.map((item)");
    expect(page).toContain("<progress value={count}");
    expect(page).toContain("aria-label={`${item.status} ${count} รายการ คิดเป็น ${percentage}%`}");
    expect(page).toContain("Math.max(totalLeads,1)");
  });

  it("presents scoped information as metrics and an overdue action", () => {
    expect(page).toContain('className="scope-metrics"');
    expect(page).toContain('className="scope-action" href="/leads?overdue=1"');
    expect(page).toContain("customers.toLocaleString");
    expect(page).toContain("activities.toLocaleString");
  });

  it("keeps both cards equal-height and responsive", () => {
    expect(css).toContain(".dashboard-insights { grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch; }");
    expect(css).toContain(".dashboard-insights>.card+.card { margin-top:0; }");
    expect(css).toContain(".dashboard-visual-card { height:100%;display:flex;flex-direction:column;overflow:hidden; }");
    expect(css).toContain(".dashboard-insights { grid-template-columns:1fr; }");
    expect(css).toContain(".scope-metrics { grid-template-columns:1fr; }");
  });
});

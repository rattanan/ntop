import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const css = readFileSync("app/globals.css", "utf8");

describe("presales KPI layout", () => {
  it("keeps Site Survey and Solution Design KPI cards aligned and equal-height", () => {
    expect(css).toMatch(/\.presales-kpis\{[^}]*grid-auto-rows:1fr;[^}]*align-items:stretch;/);
    expect(css).toContain(".presales-kpis>.card+.card{margin-top:0}");
    expect(css).toMatch(/\.presales-kpis article\{[^}]*height:100%;/);
  });
});

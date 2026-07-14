import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

describe("dashboard KPI card layout", () => {
  it("keeps every card in a dashboard row the same height", () => {
    expect(css).toContain(".stats { align-items:stretch;grid-auto-rows:1fr;");
    expect(css).toContain(".stats>.card+.card { margin-top:0; }");
    expect(css).toContain(".stat { position:relative;height:100%;");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
const page = readFileSync(join(process.cwd(), "app/(portal)/prospects/[id]/page.tsx"), "utf8");

describe("Prospect detail panel layout", () => {
  it("keeps Overview and AI Insight the same height on wide screens", () => {
    expect(page).toContain('className="card-header">Overview');
    expect(page).toContain('id="ai-insight-heading">AI Insight');
    expect(css).toContain(".detail-columns { align-items:stretch;grid-auto-rows:1fr; }");
    expect(css).toContain(".detail-columns>.card+.card { margin-top:0; }");
    expect(css).toContain(".detail-columns>.card { height:100%; }");
  });

  it("returns detail panels to natural height in a single mobile column", () => {
    expect(css).toContain(".detail-columns { grid-template-columns:1fr;grid-auto-rows:auto; }");
    expect(css).toContain(".detail-columns>.card { height:auto; }");
  });
});

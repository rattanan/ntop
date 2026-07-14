import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("app/globals.css", "utf8");
const prospectActions = readFileSync("components/prospect-action-forms.tsx", "utf8");

describe("stacked form control spacing", () => {
  it("spaces direct controls and actions inside cards", () => {
    expect(css).toContain(".card-body>.control+.control { margin-top:12px; }");
    expect(css).toContain(".card-body>.control+button");
    expect(css).toContain("margin-top:16px");
  });

  it("provides a consistent two-column card grid without inherited card margins", () => {
    expect(css).toContain(".grid-2 { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:18px; }");
    expect(css).toContain(".grid-2>.card+.card { margin-top:0; }");
    expect(css).toContain(".card+.grid-2 { margin-top:18px; }");
    expect(prospectActions).toContain('className="grid-2"');
  });

  it("stacks cards and expands actions on smaller screens", () => {
    expect(css).toContain(".grid-2 { grid-template-columns:1fr; }");
    expect(css).toContain(".card-body>.control+button { width:100%;min-height:44px; }");
  });
});

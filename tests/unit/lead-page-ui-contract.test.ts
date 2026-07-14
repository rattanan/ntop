import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Lead page UI contract", () => {
  it("does not load or render Saved Views on the Lead page", () => {
    const page = read("app/(portal)/leads/page.tsx");

    expect(page).not.toContain("LeadSavedViewControls");
    expect(page).not.toContain("prisma.leadSavedView");
    expect(page).not.toContain("defaultView");
    expect(page).not.toContain("redirect(");
  });

  it("keeps column visibility independent from Saved Views", () => {
    const page = read("app/(portal)/leads/page.tsx");
    const controls = read("components/lead-column-visibility-controls.tsx");

    expect(page).toContain("LeadColumnVisibilityControls");
    expect(controls).toContain("columnOptions");
    expect(controls).toContain('parameters.set("columns"');
    expect(controls).not.toContain("Saved View");
  });
});

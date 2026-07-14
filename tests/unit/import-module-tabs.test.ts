import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Lead and Prospect import tabs", () => {
  it("moves Lead import into a permission-aware module tab", () => {
    const page = read("app/(portal)/leads/page.tsx");

    expect(page).toContain('label:"Import Lead"');
    expect(page).toContain('href:"/leads?tab=import"');
    expect(page).toContain('activeTab==="import"?<LeadImportForm/>');
    expect(page).toContain("canImport?");
  });

  it("moves Prospect import into its permission-aware module tab", () => {
    const page = read("app/(portal)/prospects/page.tsx");

    expect(page).toContain("permissions.has(PERMISSIONS.prospectImport)");
    expect(page).toContain('href: "/prospects?tab=import"');
    expect(page).toContain("<ProspectImportForm />");
  });

  it("removes Import Prospect from the sidebar and preserves the old URL", () => {
    const navigation = read("components/app-navigation.ts");
    const legacyPage = read("app/(portal)/prospects/import/page.tsx");

    expect(navigation).not.toContain('label: "Import Prospect"');
    expect(navigation).not.toContain('href: "/prospects/import"');
    expect(legacyPage).toContain('redirect("/prospects?tab=import")');
  });

  it("uses accessible navigation links for responsive module tabs", () => {
    const tabs = read("components/module-tabs.tsx");
    const css = read("app/globals.css");

    expect(tabs).toContain("aria-current");
    expect(tabs).toContain('className="module-tabs"');
    expect(css).toContain(".module-tabs a.active");
    expect(css).toContain("grid-auto-columns:1fr");
  });
});

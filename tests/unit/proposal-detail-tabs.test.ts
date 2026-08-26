import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(join(process.cwd(), "app/(portal)/proposals/[id]/page.tsx"), "utf8");
const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

describe("Proposal detail tabs", () => {
  it("opens Proposal content by default and separates secondary information into URL tabs", () => {
    expect(page).toContain(': "proposal";');
    for (const tab of ["proposal", "compare", "history"]) expect(page).toContain(`tabHref("${tab}")`);
    expect(page).toContain('activeTab === "proposal" && <div className="proposal-workspace"');
    expect(page).toContain('activeTab === "compare" && <div className="proposal-tab-panel"');
    expect(page).toContain('activeTab === "history" && <div className="proposal-tab-panel"');
  });

  it("marks the selected tab accessibly and keeps tabs out of the print view", () => {
    expect(page).toContain('aria-label="Proposal detail sections"');
    expect(page).toContain('aria-current={activeTab === "proposal" ? "page" : undefined}');
    expect(css).toContain(".proposal-detail-tabs");
  });

  it("loads bounded version and audit data only as needed", () => {
    expect(page).toContain('const versionLimit = activeTab === "proposal" ? 1 : 100;');
    expect(page).toContain('activeTab === "history"');
    expect(page).toContain("prisma.auditEvent.findMany");
    expect(page).toContain("take: 100");
  });
});

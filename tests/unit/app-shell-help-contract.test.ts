import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getHelpArticle, searchHelpArticles } from "../../lib/help-center";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("App shell and Help Center", () => {
  it("provides collapsible grouped navigation and a notification dropdown", () => {
    const shell = read("components/app-shell.tsx");
    expect(shell).toContain("ntop-sidebar-collapsed");
    expect(shell).toContain("sidebar-submenu");
    expect(shell).toContain("notification-panel");
    expect(shell).toContain("Orchestration Platform");
    expect(shell).not.toContain("Sales Platform");
    expect(shell).toContain('href="/help"');
    expect(shell).toContain('href: "/admin/users"');
    expect(shell).toContain('href: "/admin/audit"');
  });

  it("loads notifications from owned production records instead of mock data", () => {
    const query = read("lib/notifications/header-notifications.ts");
    expect(query).toContain("ownerId: actorId");
    expect(query).toContain("makerId: actorId");
    expect(query).not.toContain("mock");
  });

  it("searches NTOP help articles and resolves article routes", () => {
    expect(searchHelpArticles("floor price", "SALES").map((item) => item.slug)).toContain("quotation-and-approval");
    expect(getHelpArticle("customer-to-opportunity")?.category).toBe("เริ่มต้นใช้งาน");
  });
});

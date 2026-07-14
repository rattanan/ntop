import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("organization administration UI contract", () => {
  it("protects the page and every mutation with the organization permission", () => {
    expect(read("app/(portal)/admin/organization/page.tsx")).toContain(
      "PERMISSIONS.organizationManage",
    );
    expect(read("app/actions/organization-admin.ts")).toContain(
      "requirePermission(PERMISSIONS.organizationManage)",
    );
  });

  it("routes mutations through the application service and exposes the admin menu", () => {
    const actions = read("app/actions/organization-admin.ts");
    expect(actions).toContain("createOrganizationAdminRuntime().createOrganizationUnit");
    expect(actions).toContain("createOrganizationAdminRuntime().updateHierarchy");
    expect(actions).toContain("createOrganizationAdminRuntime().assignManagerApprover");
    expect(read("components/app-shell.tsx")).toContain('href: "/admin/organization"');
  });

  it("uses configurable enterprise roles instead of fixing one approval role in the UI", () => {
    const component = read("components/organization-admin-console.tsx");
    expect(component).toContain("ENTERPRISE_ROLES.map");
    expect(component).not.toContain('defaultValue="TEAM_MANAGER"');
  });
});

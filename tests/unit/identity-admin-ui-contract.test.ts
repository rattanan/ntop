import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const usersPage = read("app/(portal)/admin/users/page.tsx");
const auditPage = read("app/(portal)/admin/audit/page.tsx");
const userConsole = read("components/admin-user-console.tsx");
const identityActions = read("app/actions/identity-admin.ts");
const styles = read("app/globals.css");

describe("identity administration navigation", () => {
  it("keeps user and role management separate from security history", () => {
    expect(usersPage).toContain("PERMISSIONS.userAdminManage");
    expect(usersPage).not.toContain("prisma.loginEvent.findMany");
    expect(usersPage).not.toContain("prisma.auditEvent.findMany");
  });

  it("protects the dedicated login and audit page with audit permission", () => {
    expect(auditPage).toContain("PERMISSIONS.auditRead");
    expect(auditPage).toContain("prisma.loginEvent.findMany");
    expect(auditPage).toContain("prisma.auditEvent.findMany");
    expect(auditPage).toContain("take: 200");
  });

  it("keeps table controls within fixed columns and exposes assignment organization editing", () => {
    expect(usersPage).toContain("identity-user-table-wrap");
    expect(usersPage).toContain("UpdateRoleAssignmentOrganizationForm");
    expect(userConsole).toContain("updateAdminRoleOrganization");
    expect(userConsole).toContain("บันทึกหน่วยงาน");
    expect(identityActions).toContain("updateRoleAssignmentOrganization");
    expect(styles).toContain(".identity-user-table { min-width:1180px;table-layout:fixed; }");
    expect(styles).toContain(".identity-user-table td:has(.secondary)");
  });
});

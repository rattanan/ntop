import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const usersPage = read("app/(portal)/admin/users/page.tsx");
const userEditPage = read("app/(portal)/admin/users/[id]/edit/page.tsx");
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

  it("keeps the user list compact and moves mutations to a dedicated edit route", () => {
    expect(usersPage).toContain("identity-user-table-wrap");
    expect(usersPage).toContain("<th>หน่วยงาน</th>");
    expect(usersPage).toContain('organizationUnit: { select: { id: true, code: true, name: true } }');
    expect(usersPage).toContain('data-label="หน่วยงาน"');
    expect(usersPage).toContain("identity-organization-summary");
    expect(usersPage).toContain('href={`/admin/users/${user.id}/edit`}');
    expect(usersPage).not.toContain("UpdateUserForm");
    expect(usersPage).not.toContain("UserApiKeyForm");
    expect(usersPage).not.toContain("UpdateRoleAssignmentOrganizationForm");
    expect(usersPage).not.toContain("RevokeRoleForm");
    expect(userEditPage).toContain("PERMISSIONS.userAdminManage");
    expect(userEditPage).toContain("notFound()");
    expect(userEditPage).toContain("UpdateUserForm");
    expect(userEditPage).toContain("UserApiKeyForm");
    expect(userEditPage).toContain("UpdateRoleAssignmentOrganizationForm");
    expect(userEditPage).toContain("RevokeRoleForm");
    expect(userEditPage).toContain("AssignRoleForm");
    expect(userConsole).toContain("updateAdminRoleOrganization");
    expect(userConsole).toContain("บันทึกหน่วยงาน");
    expect(identityActions).toContain("updateRoleAssignmentOrganization");
    expect(identityActions).toContain('revalidatePath("/admin/users", "layout")');
    expect(styles).toContain(".identity-user-table { min-width:980px;table-layout:fixed; }");
    expect(styles).toContain(".identity-edit-layout");
    expect(styles).toContain("@media (max-width:700px)");
  });
});

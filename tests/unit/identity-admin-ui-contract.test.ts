import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const usersPage = read("app/(portal)/admin/users/page.tsx");
const auditPage = read("app/(portal)/admin/audit/page.tsx");

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
});

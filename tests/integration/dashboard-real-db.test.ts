import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

import { loadAuthorizationContext, loadGrantedPermissions } from "../../lib/authorization/authorization-context";
import { DashboardAccessError, loadDashboardData } from "../../lib/dashboard/dashboard-query";
import { buildLeadScopeWhere } from "../../lib/lead/prisma-lead-repository";
import { buildProspectScopeWhere } from "../../lib/prospect/prospect-authorization";

const enabled = process.env.RUN_DB_INTEGRATION === "1";
const prisma = new PrismaClient();

async function actor(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, role: true } });
  const authorization = await loadAuthorizationContext({ actorId: user.id, legacyRole: user.role });
  const grantedPermissions = await loadGrantedPermissions(authorization);
  return { id: user.id, authorization, grantedPermissions };
}

describe.skipIf(!enabled)("dashboard real MySQL integration", () => {
  afterAll(async () => prisma.$disconnect());

  it("reconciles a Sales KPI with its scoped source query", async () => {
    const sales = await actor("sales1@example.test");
    const data = await loadDashboardData(sales, {});
    const sourceCount = await prisma.lead.count({ where: { AND: [buildLeadScopeWhere(sales.authorization), { status: { not: "ARCHIVED" } }] } });
    expect(data.kpis.find((item) => item.key === "leads")?.value).toBe(String(sourceCount));
    expect(data.permissions.sections).toContain("sales");
    expect(data.permissions.sections).not.toContain("executive");
  });

  it("rejects a cross-owner filter for SELF scope", async () => {
    const sales = await actor("sales1@example.test");
    const other = await prisma.user.findUniqueOrThrow({ where: { email: "sales2@example.test" }, select: { id: true } });
    await expect(loadDashboardData(sales, { ownerId: other.id })).rejects.toBeInstanceOf(DashboardAccessError);
  });

  it("reconciles the Executive prospect KPI and grants its scoped source drill-down", async () => {
    const executive = await actor("executive@example.test");
    const data = await loadDashboardData(executive, {});
    const sourceCount = await prisma.prospect.count({
      where: buildProspectScopeWhere(executive.authorization, new Set(executive.grantedPermissions)),
    });
    expect(data.kpis.find((item) => item.key === "prospects")?.value).toBe(String(sourceCount));
    expect(executive.grantedPermissions).toEqual(
      expect.arrayContaining(["nav.prospects", "prospect.view", "prospect.view_all"]),
    );
  });

  it("allows a team manager to filter a member without widening beyond the team", async () => {
    const manager = await actor("manager@example.test");
    const member = await prisma.user.findUniqueOrThrow({ where: { email: "sales2@example.test" }, select: { id: true } });
    const data = await loadDashboardData(manager, { ownerId: member.id });
    expect(data.permissions.sections).toEqual(expect.arrayContaining(["salesManager", "approver"]));
    expect(data.options.owners.some((owner) => owner.id === member.id)).toBe(true);
  });

  it.each([
    ["executive@example.test", "executive"],
    ["architect@example.test", "solution"],
    ["pricing@example.test", "approver"],
    ["contract@example.test", "operations"],
    ["success@example.test", "customerSuccess"],
    ["admin-dashboard@example.test", "admin"],
  ] as const)("returns the configured focus for %s", async (email, section) => {
    const data = await loadDashboardData(await actor(email), {});
    expect(data.permissions.sections).toContain(section);
    expect(data.roleFocus.some((item) => item.section === section)).toBe(true);
  });
});

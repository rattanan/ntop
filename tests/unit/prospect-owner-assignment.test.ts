import { describe, expect, it, vi } from "vitest";

import type { PrismaProspectRepository } from "../../lib/prospect/prospect-repository";
import { ProspectService, ProspectValidationError } from "../../lib/prospect/prospect-service";

const actor = {
  id: "manager-1",
  authorization: {
    actorId: "manager-1",
    assignments: [{ role: "TEAM_MANAGER" as const, scope: "ORG_UNIT" as const, organizationUnitId: "org-parent" }],
    organizationUnitIds: ["org-parent", "org-child"],
  },
  permissions: new Set(["prospect.view", "prospect.assign"]),
};

function setup(assignments: Array<{ organizationUnitId: string | null }>) {
  const current = {
    id: "prospect-1",
    version: 3,
    status: "CONTACTED",
    ownerId: "sales-old",
    responsibleBusinessUnitId: "org-parent",
    salesTeamId: "legacy-team",
    contacts: [],
  };
  const result = { ...current, version: 4, ownerId: "sales-new", responsibleBusinessUnitId: "org-child", salesTeamId: null };
  const tx = {
    userRoleAssignment: { findMany: vi.fn(async () => assignments) },
    prospect: {
      updateMany: vi.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: vi.fn(async () => result),
    },
    prospectAssignmentHistory: { create: vi.fn(async () => ({})) },
    prospectStatusHistory: { create: vi.fn(async () => ({})) },
  };
  const repository = {
    transaction: vi.fn(async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx)),
    findReceipt: vi.fn(async () => null),
    findAccessible: vi.fn(async () => current),
    saveReceipt: vi.fn(async () => undefined),
  };
  const audit = { append: vi.fn(async () => ({ id: "audit-1" })) };
  return { service: new ProspectService(repository as unknown as PrismaProspectRepository, audit as never), repository, audit, tx };
}

describe("Prospect owner assignment", () => {
  it("moves owner and access scope to an authorized descendant organization", async () => {
    const { service, repository, audit, tx } = setup([{ organizationUnitId: "org-child" }]);
    const assigned = await service.assign(actor, "prospect-1", 3, "sales-new", "ย้ายให้ทีมลูกดูแล", "corr-1", "key-1", "org-child");

    expect(assigned).toMatchObject({ ownerId: "sales-new", responsibleBusinessUnitId: "org-child", salesTeamId: null, version: 4 });
    expect(tx.prospect.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "prospect-1", version: 3 }),
      data: expect.objectContaining({ ownerId: "sales-new", responsibleBusinessUnitId: "org-child", salesTeamId: null }),
    }));
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({
      action: "prospect.assign",
      data: expect.objectContaining({ fromOrganizationUnitId: "org-parent", toOrganizationUnitId: "org-child" }),
    }), { transaction: tx });
    expect(repository.saveReceipt).toHaveBeenCalledWith(expect.objectContaining({ command: "prospect.assign", version: 4 }), tx);
  });

  it("rejects a user outside the manager organization subtree", async () => {
    const { service, audit, tx } = setup([]);
    await expect(service.assign(actor, "prospect-1", 3, "sales-outside", "อยู่นอกสายงาน", "corr-2", "key-2", "org-sibling")).rejects.toBeInstanceOf(ProspectValidationError);
    expect(tx.prospect.updateMany).not.toHaveBeenCalled();
    expect(audit.append).not.toHaveBeenCalled();
  });
});

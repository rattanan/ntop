import { describe, expect, it, vi } from "vitest";

import {
  OrganizationAdminService,
  OrganizationAdministrationError,
} from "../../lib/administration/organization-admin-service";
import { PERMISSIONS } from "../../lib/authorization/permission-policy";

function setup() {
  const tx = {
    organizationUnit: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    userRoleAssignment: { findFirst: vi.fn(), create: vi.fn() },
    approvalAuthorityGrant: { findFirst: vi.fn(), create: vi.fn() },
  };
  const repository = {
    transaction: vi.fn(async (work: (value: unknown) => Promise<unknown>) => work(tx)),
  };
  const audit = { append: vi.fn() };
  return {
    tx,
    repository,
    audit,
    service: new OrganizationAdminService(repository as never, audit as never),
  };
}

const assignmentInput = {
  userId: "manager-1",
  organizationUnitId: "org-1",
  roleCode: "TEAM_MANAGER",
  maximumAmount: "1500000.0000",
  customerSegment: null,
  effectiveFrom: new Date("2026-07-14T00:00:00+07:00"),
  effectiveTo: null,
};

describe("OrganizationAdminService", () => {
  it("denies organization administration before opening a transaction", async () => {
    const { service, repository } = setup();
    await expect(
      service.createOrganizationUnit(
        { id: "sales-1", role: "SALES" },
        { code: "SALES", name: "Sales", parentId: null },
        "correlation-1",
      ),
    ).rejects.toThrow(`Permission denied: ${PERMISSIONS.organizationManage}`);
    expect(repository.transaction).not.toHaveBeenCalled();
  });

  it("rejects a hierarchy update that would create a cycle", async () => {
    const { service, tx } = setup();
    tx.organizationUnit.findUnique
      .mockResolvedValueOnce({ id: "org-1", parentId: null, active: true })
      .mockResolvedValueOnce({ id: "org-2", parentId: "org-1", active: true });

    await expect(
      service.updateHierarchy(
        { id: "admin-1", role: "ADMIN" },
        { organizationUnitId: "org-1", parentId: "org-2" },
        "correlation-2",
      ),
    ).rejects.toThrow("วงวน");
    expect(tx.organizationUnit.update).not.toHaveBeenCalled();
  });

  it("prevents an administrator from granting quotation approval to self", async () => {
    const { service, repository } = setup();
    await expect(
      service.assignManagerApprover(
        { id: "manager-1", role: "ADMIN" },
        assignmentInput,
        "correlation-3",
      ),
    ).rejects.toBeInstanceOf(OrganizationAdministrationError);
    expect(repository.transaction).not.toHaveBeenCalled();
  });

  it("creates the scoped role, Decimal authority and audit atomically", async () => {
    const { service, tx, audit } = setup();
    tx.user.findUnique.mockResolvedValue({ id: "manager-1", active: true });
    tx.organizationUnit.findUnique.mockResolvedValue({ id: "org-1", active: true });
    tx.userRoleAssignment.findFirst.mockResolvedValue(null);
    tx.userRoleAssignment.create.mockResolvedValue({ id: "assignment-1" });
    tx.approvalAuthorityGrant.findFirst.mockResolvedValue(null);
    tx.approvalAuthorityGrant.create.mockResolvedValue({ id: "authority-1" });

    await service.assignManagerApprover(
      { id: "admin-1", role: "ADMIN" },
      assignmentInput,
      "correlation-4",
    );

    expect(tx.userRoleAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "manager-1",
        organizationUnitId: "org-1",
        roleCode: "TEAM_MANAGER",
        scopeCode: "ORG_UNIT",
      }),
    });
    expect(tx.approvalAuthorityGrant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        permissionCode: PERMISSIONS.approvalDecide,
        maximumAmount: "1500000.0000",
      }),
      select: { id: true },
    });
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "organization.manager-approver.assign",
        targetId: "org-1",
        correlationId: "correlation-4",
      }),
      { transaction: tx },
    );
  });
});

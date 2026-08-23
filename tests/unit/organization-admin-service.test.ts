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
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    userRoleAssignment: { findUnique: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    leadAssignmentRule: { count: vi.fn() },
    approvalAuthorityGrant: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
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

  it("updates an active organization and audits the previous values atomically", async () => {
    const { service, tx, audit } = setup();
    tx.organizationUnit.findUnique
      .mockResolvedValueOnce({ id: "org-1", code: "OLD", name: "Old name", active: true })
      .mockResolvedValueOnce(null);
    tx.organizationUnit.update.mockResolvedValue({ id: "org-1", code: "NEW", name: "New name" });

    await service.updateOrganizationUnit(
      { id: "admin-1", role: "ADMIN" },
      { organizationUnitId: "org-1", code: "new", name: "New name" },
      "correlation-update",
    );

    expect(tx.organizationUnit.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { code: "NEW", name: "New name" },
    });
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "organization.unit.update",
        targetId: "org-1",
        data: expect.objectContaining({ previousCode: "OLD", code: "NEW" }),
      }),
      { transaction: tx },
    );
  });

  it("soft-deletes an unused organization, its authorities and audits atomically", async () => {
    const { service, tx, audit } = setup();
    tx.organizationUnit.findUnique.mockResolvedValue({ id: "org-1", code: "ORG", name: "Org", parentId: null, active: true });
    tx.organizationUnit.count.mockResolvedValue(0);
    tx.userRoleAssignment.count.mockResolvedValue(0);
    tx.leadAssignmentRule.count.mockResolvedValue(0);
    tx.organizationUnit.update.mockResolvedValue({ id: "org-1", active: false });
    tx.approvalAuthorityGrant.updateMany.mockResolvedValue({ count: 2 });

    await service.removeOrganizationUnit(
      { id: "admin-1", role: "ADMIN" },
      { organizationUnitId: "org-1", reason: "ยุบหน่วยงาน" },
      "correlation-remove",
    );

    expect(tx.organizationUnit.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { active: false },
    });
    expect(tx.approvalAuthorityGrant.updateMany).toHaveBeenCalledWith({
      where: { organizationUnitId: "org-1", active: true },
      data: { active: false },
    });
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "organization.unit.remove",
        targetId: "org-1",
        reason: "ยุบหน่วยงาน",
        data: expect.objectContaining({ authorityGrantsDeactivated: 2 }),
      }),
      { transaction: tx },
    );
  });

  it("rejects removal while the organization has an active role assignment", async () => {
    const { service, tx } = setup();
    tx.organizationUnit.findUnique.mockResolvedValue({ id: "org-1", code: "ORG", name: "Org", parentId: null, active: true });
    tx.organizationUnit.count.mockResolvedValue(0);
    tx.userRoleAssignment.count.mockResolvedValue(1);
    tx.leadAssignmentRule.count.mockResolvedValue(0);

    await expect(
      service.removeOrganizationUnit(
        { id: "admin-1", role: "ADMIN" },
        { organizationUnitId: "org-1", reason: "ยุบหน่วยงาน" },
        "correlation-remove-blocked",
      ),
    ).rejects.toThrow("role assignment");
    expect(tx.organizationUnit.update).not.toHaveBeenCalled();
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

  it("revokes only the selected effective approver assignment and audits atomically", async () => {
    const { service, tx, audit } = setup();
    tx.userRoleAssignment.findUnique.mockResolvedValue({
      id: "assignment-1",
      userId: "manager-1",
      roleCode: "TEAM_MANAGER",
      scopeCode: "ORG_UNIT",
      organizationUnitId: "org-1",
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      effectiveTo: null,
      active: true,
    });
    tx.approvalAuthorityGrant.findFirst.mockResolvedValue({ id: "authority-1" });
    tx.userRoleAssignment.update.mockResolvedValue({ id: "assignment-1", active: false });

    await service.removeManagerApprover(
      { id: "admin-1", role: "ADMIN" },
      { assignmentId: "assignment-1" },
      "correlation-5",
    );

    expect(tx.userRoleAssignment.update).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: { active: false, effectiveTo: expect.any(Date) },
    });
    expect(tx.approvalAuthorityGrant.create).not.toHaveBeenCalled();
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "organization.manager-approver.revoke",
        targetType: "UserRoleAssignment",
        targetId: "assignment-1",
        correlationId: "correlation-5",
      }),
      { transaction: tx },
    );
  });

  it("rejects self-revocation before changing the assignment", async () => {
    const { service, tx } = setup();
    tx.userRoleAssignment.findUnique.mockResolvedValue({
      id: "assignment-1",
      userId: "admin-1",
      roleCode: "TEAM_MANAGER",
      scopeCode: "ORG_UNIT",
      organizationUnitId: "org-1",
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      effectiveTo: null,
      active: true,
    });

    await expect(
      service.removeManagerApprover(
        { id: "admin-1", role: "ADMIN" },
        { assignmentId: "assignment-1" },
        "correlation-6",
      ),
    ).rejects.toThrow("ผู้ดูแลระบบคนอื่น");
    expect(tx.userRoleAssignment.update).not.toHaveBeenCalled();
  });

  it("rejects an assignment without an effective quotation authority", async () => {
    const { service, tx } = setup();
    tx.userRoleAssignment.findUnique.mockResolvedValue({
      id: "assignment-1",
      userId: "manager-1",
      roleCode: "TEAM_MANAGER",
      scopeCode: "ORG_UNIT",
      organizationUnitId: "org-1",
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      effectiveTo: null,
      active: true,
    });
    tx.approvalAuthorityGrant.findFirst.mockResolvedValue(null);

    await expect(
      service.removeManagerApprover(
        { id: "admin-1", role: "ADMIN" },
        { assignmentId: "assignment-1" },
        "correlation-7",
      ),
    ).rejects.toThrow("ไม่พบผู้อนุมัติ Quotation ที่มีผล");
    expect(tx.userRoleAssignment.update).not.toHaveBeenCalled();
  });
});

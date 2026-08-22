import { describe, expect, it, vi } from "vitest";
import { IdentityAdminService, IdentityAdministrationError } from "../../lib/administration/identity-admin-service";

function setup() {
  const tx = {
    user: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    userRoleAssignment: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    organizationUnit: { findUnique: vi.fn() },
  };
  const repository = { transaction: vi.fn(async (work: (value: unknown) => Promise<unknown>) => work(tx)) };
  const audit = { append: vi.fn() };
  return { tx, repository, audit, service: new IdentityAdminService(repository as never, audit as never) };
}

describe("IdentityAdminService", () => {
  it("denies non-admin user administration before opening a transaction", async () => {
    const { service, repository } = setup();
    await expect(service.updateUser({ id: "sales", role: "SALES" }, { id: "u1", name: "User One", role: "SALES", active: true }, "c1")).rejects.toThrow("Permission denied");
    expect(repository.transaction).not.toHaveBeenCalled();
  });

  it("prevents self deactivation and self role assignment", async () => {
    const { service } = setup();
    await expect(service.updateUser({ id: "admin", role: "ADMIN" }, { id: "admin", name: "Admin User", role: "ADMIN", active: false }, "c1")).rejects.toBeInstanceOf(IdentityAdministrationError);
    await expect(service.createRoleAssignment({ id: "admin", role: "ADMIN" }, { userId: "admin", roleCode: "ADMIN", scopeCode: "ENTERPRISE", organizationUnitId: null, effectiveFrom: new Date(), effectiveTo: null }, "c2")).rejects.toThrow("ผู้ดูแลระบบคนอื่น");
  });

  it("updates a user and writes the audit event in the same transaction", async () => {
    const { service, tx, audit } = setup();
    tx.user.findUnique.mockResolvedValue({ role: "SALES", active: true });
    tx.user.update.mockResolvedValue({ id: "u1", name: "Sales One", email: "s@example.com", role: "VIEWER", active: false });
    await service.updateUser({ id: "admin", role: "ADMIN" }, { id: "u1", name: "Sales One", role: "VIEWER", active: false }, "c3");
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "identity.user.update", targetId: "u1" }), { transaction: tx });
  });

  it("updates an active assignment organization and audits it atomically", async () => {
    const { service, tx, audit } = setup();
    tx.userRoleAssignment.findUnique.mockResolvedValue({ id: "assignment-1", userId: "u1", scopeCode: "ORG_UNIT", organizationUnitId: "org-old", active: true });
    tx.organizationUnit.findUnique.mockResolvedValue({ id: "org-new", active: true });
    tx.userRoleAssignment.update.mockResolvedValue({ id: "assignment-1", organizationUnitId: "org-new" });

    await service.updateRoleAssignmentOrganization(
      { id: "admin", role: "ADMIN" },
      { assignmentId: "assignment-1", organizationUnitId: "org-new" },
      "c4",
    );

    expect(tx.userRoleAssignment.update).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: { organizationUnitId: "org-new" },
    });
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "authorization.role-assignment.organization.update",
        targetId: "assignment-1",
        data: expect.objectContaining({
          previousOrganizationUnitId: "org-old",
          organizationUnitId: "org-new",
        }),
      }),
      { transaction: tx },
    );
  });

  it("rejects self-assignment organization changes", async () => {
    const { service, tx } = setup();
    tx.userRoleAssignment.findUnique.mockResolvedValue({ id: "assignment-1", userId: "admin", scopeCode: "ORG_UNIT", organizationUnitId: "org-old", active: true });

    await expect(
      service.updateRoleAssignmentOrganization(
        { id: "admin", role: "ADMIN" },
        { assignmentId: "assignment-1", organizationUnitId: "org-new" },
        "c5",
      ),
    ).rejects.toThrow("ตนเอง");
    expect(tx.userRoleAssignment.update).not.toHaveBeenCalled();
  });

  it("requires an organization for an organization-scoped assignment update", async () => {
    const { service, tx } = setup();
    tx.userRoleAssignment.findUnique.mockResolvedValue({ id: "assignment-1", userId: "u1", scopeCode: "TEAM", organizationUnitId: "org-old", active: true });

    await expect(
      service.updateRoleAssignmentOrganization(
        { id: "admin", role: "ADMIN" },
        { assignmentId: "assignment-1", organizationUnitId: null },
        "c6",
      ),
    ).rejects.toThrow("ต้องระบุหน่วยงาน");
    expect(tx.userRoleAssignment.update).not.toHaveBeenCalled();
  });

  it("creates a per-user API key without writing the plaintext to persistence or audit", async () => {
    const { service, tx, audit } = setup();
    tx.user.create.mockResolvedValue({ id: "u1", name: "Sales One", email: "s@example.com", role: "SALES", active: true });
    const result = await service.createUser({ id: "admin", role: "ADMIN" }, { name: "Sales One", email: "s@example.com", password: "very-secure-password", role: "SALES" }, "c7");
    expect(result.apiKey).toMatch(/^ntop_[a-f0-9]{12}_[A-Za-z0-9_-]{32,}$/);
    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ apiKeyHash: expect.stringMatching(/^[a-f0-9]{64}$/), apiKeyPrefix: result.apiKeyPrefix }) }));
    expect(JSON.stringify(tx.user.create.mock.calls)).not.toContain(result.apiKey);
    expect(JSON.stringify(audit.append.mock.calls)).not.toContain(result.apiKey);
  });

  it("rotates a user API key and audits the actor", async () => {
    const { service, tx, audit } = setup();
    tx.user.findUnique.mockResolvedValue({ id: "u1" });
    const result = await service.rotateUserApiKey({ id: "admin", role: "ADMIN" }, "u1", "c8");
    expect(result.apiKey).toContain(`ntop_${result.apiKeyPrefix}_`);
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "u1" }, data: expect.objectContaining({ apiKeyPrefix: result.apiKeyPrefix }) }));
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ actorId: "admin", action: "identity.user-api-key.rotate", targetId: "u1" }), { transaction: tx });
  });
});

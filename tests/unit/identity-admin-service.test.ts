import { describe, expect, it, vi } from "vitest";
import { IdentityAdminService, IdentityAdministrationError } from "../../lib/administration/identity-admin-service";

function setup() {
  const tx = {
    user: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    userRoleAssignment: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
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
});

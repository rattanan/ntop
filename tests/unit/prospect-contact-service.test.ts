import { describe, expect, it, vi } from "vitest";

import type { PrismaProspectRepository } from "../../lib/prospect/prospect-repository";
import { ProspectService, ProspectValidationError, ProspectVersionConflictError } from "../../lib/prospect/prospect-service";

const actor = {
  id: "actor-1",
  authorization: { actorId: "actor-1", assignments: [{ role: "KAM" as const, scope: "SELF" as const, organizationUnitId: null }] },
  permissions: new Set(["prospect.update"]),
};

const primary = { id: "contact-1", prospectId: "prospect-1", name: "Primary Contact", email: "primary@example.test", phone: null, mobile: null, lineId: null, position: null, department: null, preferredContactChannel: "EMAIL", isPrimary: true, deletedAt: null };

function setup(options: { parentUpdated?: number } = {}) {
  const tx = {
    prospect: { updateMany: vi.fn(async () => ({ count: options.parentUpdated ?? 1 })) },
    prospectContact: {
      updateMany: vi.fn(async () => ({ count: 1 })),
      update: vi.fn(async () => ({})),
      findFirst: vi.fn(async () => ({ id: "contact-2" })),
      findUniqueOrThrow: vi.fn(async () => ({ ...primary, name: "Updated Contact" })),
    },
  };
  const repository = {
    transaction: vi.fn(async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx)),
    findAccessible: vi.fn(async () => ({ id: "prospect-1", version: 3, contacts: [primary, { ...primary, id: "contact-2", name: "Backup", isPrimary: false }] })),
    findReceipt: vi.fn(async () => null),
    saveReceipt: vi.fn(async () => undefined),
  };
  const audit = { append: vi.fn(async () => ({ id: "audit-1" })) };
  return { service: new ProspectService(repository as unknown as PrismaProspectRepository, audit as never), repository, audit, tx };
}

describe("Prospect contact management", () => {
  it("updates a scoped contact with optimistic versioning and audit evidence", async () => {
    const { service, repository, audit, tx } = setup();
    const result = await service.updateContact(actor, "prospect-1", "contact-1", 3, { name: "Updated Contact", email: "updated@example.test", isPrimary: true }, "corr-1", "key-1");
    expect(result).toMatchObject({ id: "contact-1", name: "Updated Contact" });
    expect(tx.prospect.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "prospect-1", version: 3 }) }));
    expect(repository.saveReceipt).toHaveBeenCalledWith(expect.objectContaining({ command: "prospect.contact.update.contact-1", version: 4 }), tx);
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "prospect.contact.update", targetId: "contact-1", outcome: "SUCCESS" }), { transaction: tx });
  });

  it("soft-deletes a contact and promotes a replacement when the primary is removed", async () => {
    const { service, repository, audit, tx } = setup();
    const result = await service.deleteContact(actor, "prospect-1", "contact-1", 3, "corr-2", "key-2");
    expect(result).toMatchObject({ id: "contact-1", deleted: true, version: 4 });
    expect(tx.prospectContact.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), deletedById: "actor-1", isPrimary: false }) }));
    expect(tx.prospectContact.update).toHaveBeenCalledWith({ where: { id: "contact-2" }, data: { isPrimary: true, updatedById: "actor-1" } });
    expect(repository.saveReceipt).toHaveBeenCalledWith(expect.objectContaining({ command: "prospect.contact.delete.contact-1", version: 4 }), tx);
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "prospect.contact.delete", data: expect.objectContaining({ wasPrimary: true }) }), { transaction: tx });
  });

  it("rejects invalid and stale parent versions", async () => {
    const invalid = setup();
    await expect(invalid.service.deleteContact(actor, "prospect-1", "contact-1", Number.NaN, "corr-3", "key-3")).rejects.toBeInstanceOf(ProspectValidationError);
    const stale = setup({ parentUpdated: 0 });
    await expect(stale.service.updateContact(actor, "prospect-1", "contact-1", 2, { name: "Updated Contact", email: "updated@example.test" }, "corr-4", "key-4")).rejects.toBeInstanceOf(ProspectVersionConflictError);
    expect(stale.audit.append).not.toHaveBeenCalled();
  });
});

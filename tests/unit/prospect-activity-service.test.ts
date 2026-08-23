import { describe, expect, it, vi } from "vitest";

import { ProspectActivityService } from "../../lib/prospect/prospect-activity-service";
import { ProspectVersionConflictError } from "../../lib/prospect/prospect-service";

const actor = {
  id: "actor-1",
  authorization: { actorId: "actor-1", assignments: [] },
  permissions: new Set(["prospect.update"]),
} as never;

function setup(updatedCount = 1) {
  const tx = {
    activity: {
      findFirst: vi.fn(async () => ({ id: "activity-1", version: 2, type: "PHONE_CALL" })),
      updateMany: vi.fn(async () => ({ count: updatedCount })),
      findUniqueOrThrow: vi.fn(async () => ({ id: "activity-1", version: 3, type: "MEETING" })),
    },
  };
  const repository = {
    transaction: vi.fn(async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx)),
    findAccessible: vi.fn(async () => ({ id: "prospect-1", version: 4 })),
    findReceipt: vi.fn(async () => null),
    saveReceipt: vi.fn(async () => undefined),
  };
  const audit = { append: vi.fn(async () => ({ id: "audit-1" })) };
  return { service: new ProspectActivityService(repository as never, audit as never), repository, tx, audit };
}

describe("ProspectActivityService", () => {
  it("updates a scoped Activity with optimistic versioning and audit evidence", async () => {
    const { service, repository, tx, audit } = setup();
    const result = await service.update(actor, "prospect-1", "activity-1", {
      expectedVersion: 2,
      activityType: "MEETING",
      subject: "Discovery meeting",
      description: "Confirmed requirements",
      nextFollowUpAt: "2026-08-24T03:00:00.000Z",
    }, "corr-1", "key-1");

    expect(result).toMatchObject({ id: "activity-1", version: 3 });
    expect(tx.activity.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "activity-1", prospectId: "prospect-1", version: 2, deletedAt: null },
      data: expect.objectContaining({ description: "Confirmed requirements", notes: "Confirmed requirements", version: { increment: 1 } }),
    }));
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "prospect.activity.update", targetVersion: "3" }), { transaction: tx });
    expect(repository.saveReceipt).toHaveBeenCalledWith(expect.objectContaining({ command: "prospect.activity.update.activity-1" }), tx);
  });

  it("soft-deletes a scoped Activity and records the supplied reason", async () => {
    const { service, repository, tx, audit } = setup();
    const result = await service.remove(actor, "prospect-1", "activity-1", { expectedVersion: 2, reason: "Duplicate entry" }, "corr-2", "key-2");

    expect(result).toMatchObject({ id: "activity-1", deleted: true, version: 3 });
    expect(tx.activity.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), deletedById: "actor-1" }) }));
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "prospect.activity.delete", reason: "Duplicate entry" }), { transaction: tx });
    expect(repository.saveReceipt).toHaveBeenCalledWith(expect.objectContaining({ command: "prospect.activity.delete.activity-1" }), tx);
  });

  it("rejects a stale Activity version without writing audit evidence", async () => {
    const { service, audit } = setup(0);
    await expect(service.remove(actor, "prospect-1", "activity-1", { expectedVersion: 1, reason: "Duplicate entry" }, "corr-3", "key-3")).rejects.toBeInstanceOf(ProspectVersionConflictError);
    expect(audit.append).not.toHaveBeenCalled();
  });

  it("rejects callers without Prospect update permission before repository access", async () => {
    const { service, repository } = setup();
    const unauthorized = { id: "actor-1", authorization: { actorId: "actor-1", assignments: [] }, permissions: new Set(["prospect.view"]) } as never;
    await expect(service.remove(unauthorized, "prospect-1", "activity-1", { expectedVersion: 2, reason: "Duplicate entry" }, "corr-4", "key-4")).rejects.toThrow();
    expect(repository.transaction).not.toHaveBeenCalled();
  });
});

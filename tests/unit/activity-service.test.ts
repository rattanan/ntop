import { describe, expect, it, vi } from "vitest";
import { ActivityService } from "../../lib/activity/activity-service";

function setup() {
  const tx = {};
  const repository = {
    transaction: vi.fn(async (work: (transaction: object) => Promise<unknown>) => work(tx)),
    findAccessible: vi.fn(async () => ({ id: "activity-1", version: 2, customerId: "customer-1", opportunityId: null })),
    targetIsAccessible: vi.fn(async () => true),
    updateVersioned: vi.fn(async () => ({ id: "activity-1", version: 3 })),
    softDeleteVersioned: vi.fn(async () => ({ id: "activity-1", version: 3 })),
  };
  const audit = { append: vi.fn(async () => ({ id: "audit-1" })) };
  const service = new ActivityService(repository as never, audit as never);
  const actor = { id: "user-1", role: "SALES", authorization: { actorId: "user-1", assignments: [{ role: "KAM", scope: "SELF", organizationUnitId: null }] } };
  return { service, repository, audit, actor, tx };
}

describe("ActivityService", () => {
  it("updates a scoped Activity with optimistic version and transactional audit", async () => {
    const { service, repository, audit, actor, tx } = setup();
    const result = await service.update(actor as never, "activity-1", { expectedVersion: 2, subject: "Follow up customer", type: "FOLLOW_UP", dueAt: null, notes: "Confirm next meeting", customerId: "customer-1", opportunityId: null }, "corr-1");
    expect(result).toEqual({ id: "activity-1", version: 3 });
    expect(repository.targetIsAccessible).toHaveBeenCalled();
    expect(repository.updateVersioned).toHaveBeenCalledWith("activity-1", 2, expect.objectContaining({ subject: "Follow up customer" }), tx);
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "activity.update", targetVersion: "3" }), { transaction: tx });
  });

  it("soft deletes with a required reason and audit evidence", async () => {
    const { service, repository, audit, actor, tx } = setup();
    await service.remove(actor as never, "activity-1", { expectedVersion: 2, reason: "Duplicate activity" }, "corr-2");
    expect(repository.softDeleteVersioned).toHaveBeenCalledWith("activity-1", 2, "user-1", tx);
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "activity.delete", reason: "Duplicate activity" }), { transaction: tx });
  });

  it("denies Viewer mutation before repository access", async () => {
    const { service, repository, actor } = setup();
    await expect(service.remove({ ...actor, role: "VIEWER" } as never, "activity-1", { expectedVersion: 2, reason: "Duplicate activity" }, "corr-3")).rejects.toThrow("Permission denied");
    expect(repository.findAccessible).not.toHaveBeenCalled();
  });
});

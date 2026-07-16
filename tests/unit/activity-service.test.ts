import { describe, expect, it, vi } from "vitest";
import { ActivityService } from "../../lib/activity/activity-service";

function setup() {
  const tx = {};
  const repository = {
    transaction: vi.fn(async (work: (transaction: object) => Promise<unknown>) => work(tx)),
    findAccessible: vi.fn(async () => ({ id: "activity-1", version: 2, ownerId: "user-1", statusCode: "OPEN", terminal: false, customerId: "customer-1", opportunityId: null })),
    targetIsAccessible: vi.fn(async () => true),
    updateVersioned: vi.fn(async () => ({ id: "activity-1", version: 3 })),
    softDeleteVersioned: vi.fn(async () => ({ id: "activity-1", version: 3 })),
    actorHasPermission: vi.fn(async () => false),
    assigneeIsEligible: vi.fn(async () => true),
    assignVersioned: vi.fn(async () => ({ id: "activity-1", version: 3 })),
    findTransition: vi.fn(async () => ({ requiredPermission: "activity.complete", ownerOnly: true, targetTerminal: true })),
    transitionVersioned: vi.fn(async () => ({ id: "activity-1", version: 3, statusCode: "COMPLETED" })),
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

  it("assigns an accessible non-terminal Activity with permission and audit evidence", async () => {
    const { service, repository, audit, actor, tx } = setup();
    vi.mocked(repository.actorHasPermission).mockResolvedValue(true);
    await expect(service.assign(actor as never, "activity-1", { expectedVersion: 2, ownerId: "user-2", reason: "Balance team workload" }, "corr-4")).resolves.toEqual({ id: "activity-1", version: 3 });
    expect(repository.assigneeIsEligible).toHaveBeenCalledWith("user-1", "user-2", actor.authorization, tx);
    expect(repository.assignVersioned).toHaveBeenCalledWith("activity-1", 2, "user-2", tx);
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "activity.assign", data: { fromOwnerId: "user-1", toOwnerId: "user-2" } }), { transaction: tx });
  });

  it("completes only through a configured transition and writes the outcome", async () => {
    const { service, repository, audit, actor, tx } = setup();
    await expect(service.transition(actor as never, "activity-1", { expectedVersion: 2, toStatusCode: "COMPLETED", reason: "Customer follow-up finished", outcome: "Kickoff confirmed" }, "corr-5")).resolves.toMatchObject({ statusCode: "COMPLETED" });
    expect(repository.findTransition).toHaveBeenCalledWith("OPEN", "COMPLETED", tx);
    expect(repository.transitionVersioned).toHaveBeenCalledWith("activity-1", 2, expect.objectContaining({ toStatusCode: "COMPLETED", completionOutcome: "Kickoff confirmed", completedAt: expect.any(Date) }), tx);
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "activity.transition", data: expect.objectContaining({ fromStatusCode: "OPEN", toStatusCode: "COMPLETED" }) }), { transaction: tx });
  });

  it("prevents a non-owner from completing an owner-only Activity", async () => {
    const { service, repository, actor } = setup();
    vi.mocked(repository.findAccessible).mockResolvedValue({ id: "activity-1", version: 2, ownerId: "user-2", statusCode: "OPEN", terminal: false, customerId: "customer-1", opportunityId: null });
    await expect(service.transition(actor as never, "activity-1", { expectedVersion: 2, toStatusCode: "COMPLETED", reason: "Try complete" }, "corr-6")).rejects.toThrow("Permission denied");
    expect(repository.transitionVersioned).not.toHaveBeenCalled();
  });
});

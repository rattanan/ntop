import { describe, expect, it, vi } from "vitest";

import { PrismaMeetingConfirmationRepository } from "../../lib/ai/prisma-meeting-confirmation-repository";

describe("PrismaMeetingConfirmationRepository", () => {
  it("scopes draft lookup to the AI job requester", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new PrismaMeetingConfirmationRepository({} as never);

    await repository.findAuthorizedDraft(
      "output-1",
      "user-1",
      { aiOutput: { findFirst } } as never,
    );

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "output-1",
          job: { requestedById: "user-1" },
        },
      }),
    );
  });

  it("persists selected content without widening activity fields", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "confirmation-1",
      activityId: "activity-1",
    });
    const repository = new PrismaMeetingConfirmationRepository({} as never);

    await repository.createConfirmation(
      {
        idempotencyKey: "confirm-1",
        aiOutputId: "output-1",
        activityId: "activity-1",
        nextActionActivityId: null,
        selectedFields: ["meetingSummary"],
        finalContent: { meetingSummary: "Confirmed summary" },
        confirmedById: "user-1",
        confirmedAt: new Date("2026-07-11T03:00:00.000Z"),
      },
      { meetingDraftConfirmation: { create } } as never,
    );

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idempotencyKey: "confirm-1",
        selectedFields: ["meetingSummary"],
        finalContent: { meetingSummary: "Confirmed summary" },
      }),
      select: { id: true, activityId: true },
    });
  });

  it("enforces ownership and customer-opportunity relationship for sales", async () => {
    const opportunityFindFirst = vi.fn().mockResolvedValue({ id: "opp-1" });
    const customerFindFirst = vi.fn().mockResolvedValue({ id: "customer-1" });
    const repository = new PrismaMeetingConfirmationRepository({} as never);

    await expect(
      repository.canCreateActivityForTargets(
        {
          actorId: "user-1",
          actorRole: "SALES",
          customerId: "customer-1",
          opportunityId: "opp-1",
        },
        {
          opportunity: { findFirst: opportunityFindFirst },
          customer: { findFirst: customerFindFirst },
        } as never,
      ),
    ).resolves.toBe(true);
    expect(opportunityFindFirst).toHaveBeenCalledWith({
      where: {
        id: "opp-1",
        ownerId: "user-1",
        customerId: "customer-1",
      },
      select: { id: true },
    });
    expect(customerFindFirst).toHaveBeenCalledWith({
      where: { id: "customer-1", ownerId: "user-1" },
      select: { id: true },
    });
  });

  it("rejects activity types outside the configured enum", async () => {
    const repository = new PrismaMeetingConfirmationRepository({} as never);

    expect(() =>
      repository.createActivity(
        {
          subject: "Customer meeting",
          activityType: "UNAPPROVED_TYPE",
          dueAt: null,
          notes: null,
          aiSummary: null,
          actionItems: null,
          ownerId: "user-1",
          customerId: null,
          opportunityId: null,
        },
        { activity: { create: vi.fn() } } as never,
      ),
    ).toThrow("Unsupported activity type.");
  });
});

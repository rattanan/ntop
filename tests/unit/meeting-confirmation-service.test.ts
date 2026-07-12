import { describe, expect, it, vi } from "vitest";

import type { AuditWriter } from "../../lib/audit/audit-writer";
import {
  MeetingConfirmationError,
  MeetingConfirmationService,
  type MeetingConfirmationRepository,
} from "../../lib/ai/meeting-confirmation-service";
import { MEETING_DRAFT_SCHEMA_VERSION } from "../../lib/ai/meeting-draft-schema";

type Transaction = { id: string };
const now = new Date("2026-07-11T12:00:00.000Z");
const draft = {
  schemaVersion: MEETING_DRAFT_SCHEMA_VERSION,
  meetingSummary: "Draft summary",
  keyRequirements: [],
  decisionsAndAgreements: [],
  actionItems: [{ description: "Follow up", suggestedOwner: null, suggestedDueAt: null }],
  risksAndConcerns: [],
  suggestedNextAction: null,
  suggestedActivity: null,
};

function setup(existing: { id: string; activityId: string } | null = null) {
  const transaction = { id: "tx-1" };
  const repository: MeetingConfirmationRepository<Transaction> = {
    transaction: vi.fn(async (work) => work(transaction)),
    findByIdempotencyKey: vi.fn().mockResolvedValue(existing),
    findAuthorizedDraft: vi.fn().mockResolvedValue({ id: "output-1", status: "DRAFT", validatedOutput: draft }),
    canCreateActivityForTargets: vi.fn().mockResolvedValue(true),
    createActivity: vi.fn().mockResolvedValue({ id: "activity-1" }),
    createConfirmation: vi.fn().mockResolvedValue({ id: "confirmation-1", activityId: "activity-1" }),
    markOutputConfirmed: vi.fn().mockResolvedValue(undefined),
  };
  const auditWriter: AuditWriter<Transaction> = {
    append: vi.fn(async (event) => ({ ...event, id: "audit-1", recordedAt: now })),
  };
  return {
    service: new MeetingConfirmationService(repository, auditWriter, () => now),
    repository,
    auditWriter,
    transaction,
  };
}

const input = {
  idempotencyKey: "confirm-1",
  outputId: "output-1",
  selectedFields: ["meetingSummary", "actionItems"],
  finalContent: { meetingSummary: "Edited summary", actionItems: draft.actionItems },
  activitySubject: "Customer meeting",
  activityType: "MEETING",
  dueAt: null,
};

describe("MeetingConfirmationService", () => {
  it("creates Activity, confirmation, output transition and audit in one transaction", async () => {
    const { service, repository, auditWriter, transaction } = setup();

    await expect(
      service.confirm({ id: "user-1", role: "SALES" }, input, "request-1"),
    ).resolves.toEqual({ id: "confirmation-1", activityId: "activity-1" });
    expect(repository.createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        aiSummary: "Edited summary",
        actionItems: "Follow up",
        ownerId: "user-1",
      }),
      transaction,
    );
    expect(repository.markOutputConfirmed).toHaveBeenCalledWith(
      { outputId: "output-1", actorId: "user-1", confirmedAt: now },
      transaction,
    );
    expect(auditWriter.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ai.meeting-draft.confirm" }),
      { transaction },
    );
  });

  it("returns an existing confirmation without duplicate writes", async () => {
    const existing = { id: "confirmation-1", activityId: "activity-1" };
    const { service, repository } = setup(existing);

    await expect(
      service.confirm({ id: "user-1", role: "SALES" }, input, "request-2"),
    ).resolves.toBe(existing);
    expect(repository.findAuthorizedDraft).not.toHaveBeenCalled();
    expect(repository.createActivity).not.toHaveBeenCalled();
  });

  it("rejects unknown or unselected final fields", async () => {
    const { service, repository } = setup();

    await expect(
      service.confirm(
        { id: "user-1", role: "SALES" },
        { ...input, selectedFields: ["opportunityStage"] },
        "request-3",
      ),
    ).rejects.toBeInstanceOf(MeetingConfirmationError);
    await expect(
      service.confirm(
        { id: "user-1", role: "SALES" },
        { ...input, selectedFields: ["risksAndConcerns"] },
        "request-4",
      ),
    ).rejects.toBeInstanceOf(MeetingConfirmationError);
    expect(repository.createActivity).not.toHaveBeenCalled();
  });

  it("fails without disclosing unauthorized or non-draft output state", async () => {
    const { service, repository } = setup();
    vi.mocked(repository.findAuthorizedDraft).mockResolvedValue(null);

    await expect(
      service.confirm({ id: "user-1", role: "SALES" }, input, "request-5"),
    ).rejects.toBeInstanceOf(MeetingConfirmationError);
  });

  it("rejects customer or opportunity targets outside server-side scope", async () => {
    const { service, repository } = setup();
    vi.mocked(repository.canCreateActivityForTargets).mockResolvedValue(false);

    await expect(
      service.confirm(
        { id: "user-1", role: "SALES" },
        { ...input, customerId: "customer-other" },
        "request-6",
      ),
    ).rejects.toBeInstanceOf(MeetingConfirmationError);
    expect(repository.createActivity).not.toHaveBeenCalled();
  });

  it("creates one idempotent Task only after Next Action confirmation", async () => {
    const { service, repository, transaction } = setup();
    vi.mocked(repository.createActivity)
      .mockResolvedValueOnce({ id: "activity-1" })
      .mockResolvedValueOnce({ id: "task-1" });

    await service.confirm(
      { id: "user-1", role: "SALES" },
      {
        ...input,
        selectedFields: ["meetingSummary", "suggestedNextAction"],
        finalContent: {
          meetingSummary: "Edited summary",
          suggestedNextAction: {
            description: "ส่ง Proposal",
            suggestedDueAt: "2026-07-20T09:00:00+07:00",
          },
        },
        confirmNextAction: true,
      },
      "request-7",
    );

    expect(repository.createActivity).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        subject: "ส่ง Proposal",
        activityType: "TASK",
        dueAt: new Date("2026-07-20T02:00:00.000Z"),
        ownerId: "user-1",
      }),
      transaction,
    );
    expect(repository.createConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ nextActionActivityId: "task-1" }),
      transaction,
    );
  });
});

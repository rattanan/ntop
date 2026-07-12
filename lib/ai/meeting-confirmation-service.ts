import type { Role } from "@prisma/client";

import type { AuditJsonValue } from "../audit/redact-audit-data";
import type { AuditWriter } from "../audit/audit-writer";
import type { MeetingDraftOutput } from "./meeting-draft-schema";

const CONFIRMABLE_FIELDS = new Set<keyof MeetingDraftOutput>([
  "meetingSummary",
  "keyRequirements",
  "decisionsAndAgreements",
  "actionItems",
  "risksAndConcerns",
  "suggestedNextAction",
  "suggestedActivity",
]);

export interface MeetingConfirmationRepository<TTransaction> {
  transaction<T>(work: (transaction: TTransaction) => Promise<T>): Promise<T>;
  findByIdempotencyKey(
    key: string,
    transaction: TTransaction,
  ): Promise<{ id: string; activityId: string } | null>;
  findAuthorizedDraft(
    outputId: string,
    actorId: string,
    transaction: TTransaction,
  ): Promise<{
    id: string;
    status: "DRAFT" | "CONFIRMED" | "REJECTED" | "ABANDONED";
    validatedOutput: MeetingDraftOutput;
  } | null>;
  canCreateActivityForTargets(
    input: {
      actorId: string;
      actorRole: Role;
      customerId: string | null;
      opportunityId: string | null;
    },
    transaction: TTransaction,
  ): Promise<boolean>;
  createActivity(
    input: {
      subject: string;
      activityType: string;
      dueAt: Date | null;
      notes: string | null;
      aiSummary: string | null;
      actionItems: string | null;
      ownerId: string;
      customerId: string | null;
      opportunityId: string | null;
    },
    transaction: TTransaction,
  ): Promise<{ id: string }>;
  createConfirmation(
    input: {
      idempotencyKey: string;
      aiOutputId: string;
      activityId: string;
      nextActionActivityId: string | null;
      selectedFields: readonly string[];
      finalContent: AuditJsonValue;
      confirmedById: string;
      confirmedAt: Date;
    },
    transaction: TTransaction,
  ): Promise<{ id: string; activityId: string }>;
  markOutputConfirmed(
    input: { outputId: string; actorId: string; confirmedAt: Date },
    transaction: TTransaction,
  ): Promise<void>;
}

export class MeetingConfirmationError extends Error {
  constructor() {
    super("Meeting Draft confirmation is invalid or unavailable.");
    this.name = "MeetingConfirmationError";
  }
}

export class MeetingConfirmationService<TTransaction> {
  constructor(
    private readonly repository: MeetingConfirmationRepository<TTransaction>,
    private readonly auditWriter: AuditWriter<TTransaction>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async confirm(
    actor: { id: string; role: Role },
    input: {
      idempotencyKey: string;
      outputId: string;
      selectedFields: readonly string[];
      finalContent: Partial<MeetingDraftOutput>;
      activitySubject: string;
      activityType: string;
      dueAt: Date | null;
      customerId?: string;
      opportunityId?: string;
      notes?: string;
      confirmNextAction?: boolean;
    },
    correlationId: string,
  ) {
    if (
      !input.idempotencyKey ||
      !input.activitySubject.trim() ||
      !input.activityType.trim() ||
      input.selectedFields.length === 0 ||
      input.selectedFields.some(
        (field) => !CONFIRMABLE_FIELDS.has(field as keyof MeetingDraftOutput),
      )
    ) {
      throw new MeetingConfirmationError();
    }

    return this.repository.transaction(async (transaction) => {
      const existing = await this.repository.findByIdempotencyKey(
        input.idempotencyKey,
        transaction,
      );
      if (existing) return existing;

      const draft = await this.repository.findAuthorizedDraft(
        input.outputId,
        actor.id,
        transaction,
      );
      if (!draft || draft.status !== "DRAFT") {
        throw new MeetingConfirmationError();
      }
      const canCreate = await this.repository.canCreateActivityForTargets(
        {
          actorId: actor.id,
          actorRole: actor.role,
          customerId: input.customerId ?? null,
          opportunityId: input.opportunityId ?? null,
        },
        transaction,
      );
      if (!canCreate) throw new MeetingConfirmationError();
      const selectedContent: Record<string, AuditJsonValue> = {};
      for (const field of input.selectedFields) {
        const value = input.finalContent[field as keyof MeetingDraftOutput];
        if (value === undefined) throw new MeetingConfirmationError();
        selectedContent[field] = value as AuditJsonValue;
      }

      const actionItems = Array.isArray(selectedContent.actionItems)
        ? selectedContent.actionItems
            .map((item) =>
              item && typeof item === "object" && !Array.isArray(item)
                ? item.description
                : null,
            )
            .filter((value): value is string => typeof value === "string")
            .join("\n")
        : null;
      const summary =
        typeof selectedContent.meetingSummary === "string"
          ? selectedContent.meetingSummary
          : null;
      const confirmedAt = this.now();
      const activity = await this.repository.createActivity(
        {
          subject: input.activitySubject.trim(),
          activityType: input.activityType,
          dueAt: input.dueAt,
          notes: input.notes?.trim() || null,
          aiSummary: summary,
          actionItems: actionItems || null,
          ownerId: actor.id,
          customerId: input.customerId ?? null,
          opportunityId: input.opportunityId ?? null,
        },
        transaction,
      );
      const nextAction =
        input.confirmNextAction &&
        selectedContent.suggestedNextAction &&
        typeof selectedContent.suggestedNextAction === "object" &&
        !Array.isArray(selectedContent.suggestedNextAction) &&
        typeof selectedContent.suggestedNextAction.description === "string"
          ? await this.repository.createActivity(
              {
                subject: selectedContent.suggestedNextAction.description,
                activityType: "TASK",
                dueAt:
                  typeof selectedContent.suggestedNextAction.suggestedDueAt ===
                    "string" &&
                  !Number.isNaN(
                    new Date(
                      selectedContent.suggestedNextAction.suggestedDueAt,
                    ).getTime(),
                  )
                    ? new Date(
                        selectedContent.suggestedNextAction.suggestedDueAt,
                      )
                    : null,
                notes: "สร้างจาก AI Suggested Next Action หลังผู้ใช้ยืนยัน",
                aiSummary: null,
                actionItems: null,
                ownerId: actor.id,
                customerId: input.customerId ?? null,
                opportunityId: input.opportunityId ?? null,
              },
              transaction,
            )
          : null;
      const confirmation = await this.repository.createConfirmation(
        {
          idempotencyKey: input.idempotencyKey,
          aiOutputId: draft.id,
          activityId: activity.id,
          nextActionActivityId: nextAction?.id ?? null,
          selectedFields: input.selectedFields,
          finalContent: selectedContent,
          confirmedById: actor.id,
          confirmedAt,
        },
        transaction,
      );
      await this.repository.markOutputConfirmed(
        { outputId: draft.id, actorId: actor.id, confirmedAt },
        transaction,
      );
      await this.auditWriter.append(
        {
          actorId: actor.id,
          action: "ai.meeting-draft.confirm",
          targetType: "Activity",
          targetId: activity.id,
          outcome: "SUCCESS",
          correlationId,
          data: {
            aiOutputId: draft.id,
            selectedFields: [...input.selectedFields],
            nextActionActivityId: nextAction?.id ?? null,
          },
        },
        { transaction },
      );
      return confirmation;
    });
  }
}

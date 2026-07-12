import { ActivityType, Prisma, PrismaClient } from "@prisma/client";

import type { AuditJsonValue } from "../audit/redact-audit-data";
import { parseMeetingDraftOutput } from "./meeting-draft-schema";
import type { MeetingConfirmationRepository } from "./meeting-confirmation-service";

export type MeetingConfirmationTransaction = Prisma.TransactionClient;

function toActivityType(value: string) {
  if (!Object.values(ActivityType).includes(value as ActivityType)) {
    throw new Error("Unsupported activity type.");
  }
  return value as ActivityType;
}

export class PrismaMeetingConfirmationRepository
  implements MeetingConfirmationRepository<MeetingConfirmationTransaction>
{
  constructor(private readonly client: PrismaClient) {}

  transaction<T>(
    work: (transaction: MeetingConfirmationTransaction) => Promise<T>,
  ) {
    return this.client.$transaction(work);
  }

  findByIdempotencyKey(
    key: string,
    transaction: MeetingConfirmationTransaction,
  ) {
    return transaction.meetingDraftConfirmation.findUnique({
      where: { idempotencyKey: key },
      select: { id: true, activityId: true },
    });
  }

  async findAuthorizedDraft(
    outputId: string,
    actorId: string,
    transaction: MeetingConfirmationTransaction,
  ) {
    const output = await transaction.aiOutput.findFirst({
      where: {
        id: outputId,
        job: { requestedById: actorId },
      },
      select: { id: true, status: true, validatedOutput: true },
    });
    if (!output?.validatedOutput) return null;
    return {
      id: output.id,
      status: output.status,
      validatedOutput: parseMeetingDraftOutput(output.validatedOutput),
    };
  }

  async canCreateActivityForTargets(
    input: {
      actorId: string;
      actorRole: "ADMIN" | "SALES" | "VIEWER";
      customerId: string | null;
      opportunityId: string | null;
    },
    transaction: MeetingConfirmationTransaction,
  ) {
    if (input.actorRole === "VIEWER") return false;
    if (!input.customerId && !input.opportunityId) return true;

    if (input.opportunityId) {
      const opportunity = await transaction.opportunity.findFirst({
        where: {
          id: input.opportunityId,
          ...(input.actorRole === "ADMIN" ? {} : { ownerId: input.actorId }),
          ...(input.customerId ? { customerId: input.customerId } : {}),
        },
        select: { id: true },
      });
      if (!opportunity) return false;
    }
    if (input.customerId) {
      const customer = await transaction.customer.findFirst({
        where: {
          id: input.customerId,
          ...(input.actorRole === "ADMIN" ? {} : { ownerId: input.actorId }),
        },
        select: { id: true },
      });
      if (!customer) return false;
    }
    return true;
  }

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
    transaction: MeetingConfirmationTransaction,
  ) {
    return transaction.activity.create({
      data: {
        subject: input.subject,
        type: toActivityType(input.activityType),
        dueAt: input.dueAt,
        notes: input.notes,
        aiSummary: input.aiSummary,
        actionItems: input.actionItems,
        ownerId: input.ownerId,
        customerId: input.customerId,
        opportunityId: input.opportunityId,
      },
      select: { id: true },
    });
  }

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
    transaction: MeetingConfirmationTransaction,
  ) {
    return transaction.meetingDraftConfirmation.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        aiOutputId: input.aiOutputId,
        activityId: input.activityId,
        nextActionActivityId: input.nextActionActivityId,
        selectedFields: [...input.selectedFields],
        finalContent: input.finalContent as Prisma.InputJsonValue,
        confirmedById: input.confirmedById,
        confirmedAt: input.confirmedAt,
      },
      select: { id: true, activityId: true },
    });
  }

  async markOutputConfirmed(
    input: { outputId: string; actorId: string; confirmedAt: Date },
    transaction: MeetingConfirmationTransaction,
  ) {
    await transaction.aiOutput.update({
      where: { id: input.outputId },
      data: {
        status: "CONFIRMED",
        confirmedById: input.actorId,
        confirmedAt: input.confirmedAt,
      },
    });
  }
}

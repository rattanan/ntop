import { Prisma, PrismaClient } from "@prisma/client";

import type {
  AiGovernanceRepository,
  AiOutputProvenance,
} from "./governance-service";

export type GovernanceTransaction = Prisma.TransactionClient;

export class PrismaAiGovernanceRepository
  implements AiGovernanceRepository<GovernanceTransaction>
{
  constructor(private readonly client: PrismaClient) {}

  transaction<T>(work: (transaction: GovernanceTransaction) => Promise<T>) {
    return this.client.$transaction(work);
  }

  createDraft(input: AiOutputProvenance, transaction: GovernanceTransaction) {
    return transaction.aiOutput.create({
      data: {
        ...input,
        inputSourceReferences:
          input.inputSourceReferences as Prisma.InputJsonValue,
        validatedOutput: input.validatedOutput as Prisma.InputJsonValue,
      },
      select: { id: true, status: true },
    });
  }

  findAuthorizedOutput(
    outputId: string,
    actorId: string,
    transaction: GovernanceTransaction,
  ) {
    return transaction.aiOutput.findFirst({
      where: { id: outputId, job: { requestedById: actorId } },
      select: { id: true, status: true },
    });
  }

  appendFeedback(
    input: {
      outputId: string;
      actorId: string;
      rating: "HELPFUL" | "INCORRECT" | "UNSAFE";
      comment: string | null;
    },
    transaction: GovernanceTransaction,
  ) {
    return transaction.aiFeedback.create({
      data: input,
      select: { id: true },
    });
  }

  async markAbandoned(
    input: {
      outputId: string;
      reason: string | null;
      expiresAt: Date;
      clearValidatedOutput: true;
    },
    transaction: GovernanceTransaction,
  ) {
    await transaction.aiOutput.update({
      where: { id: input.outputId },
      data: {
        status: "ABANDONED",
        abandonedReason: input.reason,
        expiresAt: input.expiresAt,
        validatedOutput: Prisma.DbNull,
      },
    });
  }

  async purgeExpiredMetadata(
    input: {
      before: Date;
      statuses: readonly ["REJECTED", "ABANDONED"];
      legalHold: false;
    },
    transaction: GovernanceTransaction,
  ) {
    const result = await transaction.aiOutput.updateMany({
      where: {
        status: { in: [...input.statuses] },
        legalHold: input.legalHold,
        expiresAt: { lte: input.before },
        validatedOutput: { not: Prisma.DbNull },
      },
      data: { validatedOutput: Prisma.DbNull },
    });
    return { purgedCount: result.count };
  }
}

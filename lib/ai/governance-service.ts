import type { AuditJsonValue } from "../audit/redact-audit-data";
import type { AuditWriter } from "../audit/audit-writer";
import { validateAiInput } from "./safety-policy";

export const AI_FEEDBACK_IS_TRAINING_CONSENT = false as const;

export type AiFeedbackRating = "HELPFUL" | "INCORRECT" | "UNSAFE";
export type AiOutputStatus = "DRAFT" | "CONFIRMED" | "REJECTED" | "ABANDONED";

export type AiOutputProvenance = {
  jobId: string;
  providerConfigurationVersionId: string;
  capability: string;
  outputSchemaVersion: string;
  providerModel: string;
  promptTemplateVersion: string;
  inputSourceReferences: AuditJsonValue;
  validatedOutput: AuditJsonValue;
  safetyResult: "PASSED" | "REJECTED" | "REVIEW_REQUIRED";
  confidenceBand: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export interface AiGovernanceRepository<TTransaction> {
  transaction<T>(work: (transaction: TTransaction) => Promise<T>): Promise<T>;
  createDraft(
    input: AiOutputProvenance,
    transaction: TTransaction,
  ): Promise<{ id: string; status: AiOutputStatus }>;
  findAuthorizedOutput(
    outputId: string,
    actorId: string,
    transaction: TTransaction,
  ): Promise<{ id: string; status: AiOutputStatus } | null>;
  appendFeedback(
    input: {
      outputId: string;
      actorId: string;
      rating: AiFeedbackRating;
      comment: string | null;
    },
    transaction: TTransaction,
  ): Promise<{ id: string }>;
  markAbandoned(
    input: {
      outputId: string;
      reason: string | null;
      expiresAt: Date;
      clearValidatedOutput: true;
    },
    transaction: TTransaction,
  ): Promise<void>;
  purgeExpiredMetadata(
    input: {
      before: Date;
      statuses: readonly ["REJECTED", "ABANDONED"];
      legalHold: false;
    },
    transaction: TTransaction,
  ): Promise<{ purgedCount: number }>;
}

export class AiGovernanceAccessError extends Error {
  constructor() {
    super("AI output is not available.");
    this.name = "AiGovernanceAccessError";
  }
}

type AiGovernanceServiceDependencies<TTransaction> = {
  repository: AiGovernanceRepository<TTransaction>;
  auditWriter: AuditWriter<TTransaction>;
  abandonedMetadataRetentionMs: number;
  maxFeedbackCharacters: number;
  now?: () => Date;
};

export class AiGovernanceService<TTransaction> {
  private readonly repository: AiGovernanceRepository<TTransaction>;
  private readonly auditWriter: AuditWriter<TTransaction>;
  private readonly abandonedMetadataRetentionMs: number;
  private readonly maxFeedbackCharacters: number;
  private readonly now: () => Date;

  constructor({
    repository,
    auditWriter,
    abandonedMetadataRetentionMs,
    maxFeedbackCharacters,
    now = () => new Date(),
  }: AiGovernanceServiceDependencies<TTransaction>) {
    this.repository = repository;
    this.auditWriter = auditWriter;
    this.abandonedMetadataRetentionMs = abandonedMetadataRetentionMs;
    this.maxFeedbackCharacters = maxFeedbackCharacters;
    this.now = now;
  }

  async createDraft(
    actorId: string,
    provenance: AiOutputProvenance,
    correlationId: string,
  ) {
    return this.repository.transaction(async (transaction) => {
      const created = await this.repository.createDraft(
        {
          jobId: provenance.jobId,
          providerConfigurationVersionId:
            provenance.providerConfigurationVersionId,
          capability: provenance.capability,
          outputSchemaVersion: provenance.outputSchemaVersion,
          providerModel: provenance.providerModel,
          promptTemplateVersion: provenance.promptTemplateVersion,
          inputSourceReferences: provenance.inputSourceReferences,
          validatedOutput: provenance.validatedOutput,
          safetyResult: provenance.safetyResult,
          confidenceBand: provenance.confidenceBand,
          latencyMs: provenance.latencyMs,
          inputTokens: provenance.inputTokens,
          outputTokens: provenance.outputTokens,
          totalTokens: provenance.totalTokens,
        },
        transaction,
      );
      await this.auditWriter.append(
        {
          actorId,
          action: "ai.output.draft.create",
          targetType: "AiOutput",
          targetId: created.id,
          outcome: "SUCCESS",
          correlationId,
          data: {
            capability: provenance.capability,
            outputSchemaVersion: provenance.outputSchemaVersion,
            providerConfigurationVersionId:
              provenance.providerConfigurationVersionId,
          },
        },
        { transaction },
      );
      return created;
    });
  }

  async recordFeedback(
    actorId: string,
    input: { outputId: string; rating: AiFeedbackRating; comment?: string },
    correlationId: string,
  ) {
    const validated = validateAiInput({
      capability: "ai-feedback",
      policy: {
        capability: "ai-feedback",
        allowedFields: ["comment"],
        requiredFields: [],
        maxCharacters: this.maxFeedbackCharacters,
      },
      input: input.comment === undefined ? {} : { comment: input.comment },
      authorizedFields: new Set(["comment"]),
    });

    return this.repository.transaction(async (transaction) => {
      const output = await this.repository.findAuthorizedOutput(
        input.outputId,
        actorId,
        transaction,
      );
      if (!output) throw new AiGovernanceAccessError();

      const feedback = await this.repository.appendFeedback(
        {
          outputId: output.id,
          actorId,
          rating: input.rating,
          comment:
            typeof validated.comment === "string" ? validated.comment : null,
        },
        transaction,
      );
      await this.auditWriter.append(
        {
          actorId,
          action: "ai.output.feedback.create",
          targetType: "AiOutput",
          targetId: output.id,
          outcome: "SUCCESS",
          correlationId,
          data: { rating: input.rating, feedbackId: feedback.id },
        },
        { transaction },
      );
      return feedback;
    });
  }

  async abandon(
    actorId: string,
    outputId: string,
    reason: string | undefined,
    correlationId: string,
  ) {
    return this.repository.transaction(async (transaction) => {
      const output = await this.repository.findAuthorizedOutput(
        outputId,
        actorId,
        transaction,
      );
      if (!output) throw new AiGovernanceAccessError();
      const expiresAt = new Date(
        this.now().getTime() + this.abandonedMetadataRetentionMs,
      );
      await this.repository.markAbandoned(
        {
          outputId,
          reason: reason ?? null,
          expiresAt,
          clearValidatedOutput: true,
        },
        transaction,
      );
      await this.auditWriter.append(
        {
          actorId,
          action: "ai.output.abandon",
          targetType: "AiOutput",
          targetId: outputId,
          outcome: "SUCCESS",
          correlationId,
          data: { expiresAt: expiresAt.toISOString() },
        },
        { transaction },
      );
    });
  }

  async purgeExpired(systemActorId: string, correlationId: string) {
    return this.repository.transaction(async (transaction) => {
      const result = await this.repository.purgeExpiredMetadata(
        {
          before: this.now(),
          statuses: ["REJECTED", "ABANDONED"],
          legalHold: false,
        },
        transaction,
      );
      await this.auditWriter.append(
        {
          actorId: systemActorId,
          action: "ai.output.expired-metadata.purge",
          targetType: "AiOutputBatch",
          targetId: correlationId,
          outcome: "SUCCESS",
          correlationId,
          data: { purgedCount: result.purgedCount },
        },
        { transaction },
      );
      return result;
    });
  }
}

import { z } from "zod";

import {
  MEETING_DRAFT_PROMPT_VERSION,
  MEETING_DRAFT_SCHEMA_VERSION,
  parseMeetingDraftOutput,
} from "./meeting-draft-schema";
import type { OpenAiCompatibleClient } from "./openai-compatible-client";
import type { AiOperationResult, AiOperationsGate } from "./operations-gate";
import { buildIsolatedPrompt } from "./safety-policy";

export const DEAL_RISK_EXPLANATION_CAPABILITY = "deal-risk-explanation";

const signalInputSchema = z.strictObject({
  riskType: z.string().min(1).max(100),
  ruleCode: z.string().min(1).max(100),
  ruleVersion: z.number().int().positive(),
  thresholdSnapshot: z.record(z.string(), z.unknown()),
  triggeringFacts: z.record(z.string(), z.unknown()),
  severitySnapshot: z.record(z.string(), z.unknown()),
});

export type DealRiskExplanationInput = z.infer<typeof signalInputSchema>;

export class DealRiskExplanationInputError extends Error {
  constructor() {
    super("Deal Risk explanation input or output is invalid.");
    this.name = "DealRiskExplanationInputError";
  }
}

export function dealRiskExplanationSystemInstruction() {
  return [
    "Return one JSON object using schemaVersion " + MEETING_DRAFT_SCHEMA_VERSION + ".",
    "Explain only the supplied deterministic signal. The rule remains the source of truth.",
    "Put the concise explanation in meetingSummary and risksAndConcerns.",
    "Put one practical recommendation in suggestedNextAction.",
    "Use empty arrays for keyRequirements, decisionsAndAgreements and actionItems.",
    "Set suggestedActivity to null. Do not change opportunity stage, probability, price, approval or any record.",
    "Dates must include an explicit timezone offset. Return JSON only with no extra fields.",
  ].join("\n");
}

export class DealRiskExplanationService {
  constructor(
    private readonly client: OpenAiCompatibleClient,
    private readonly operationsGate: AiOperationsGate,
  ) {}

  async generate(
    input: DealRiskExplanationInput,
  ): Promise<AiOperationResult<ReturnType<typeof parseMeetingDraftOutput>>> {
    const parsed = signalInputSchema.safeParse(input);
    if (!parsed.success) throw new DealRiskExplanationInputError();
    const messages = buildIsolatedPrompt({
      systemInstruction: dealRiskExplanationSystemInstruction(),
      validatedInput: parsed.data,
    });
    return this.operationsGate.execute({
      capability: DEAL_RISK_EXPLANATION_CAPABILITY,
      run: async () => {
        const completion = await this.client.createChatCompletion(messages);
        let payload: unknown;
        try {
          payload = JSON.parse(completion.content);
        } catch {
          throw new DealRiskExplanationInputError();
        }
        let value;
        try {
          value = parseMeetingDraftOutput(payload);
        } catch {
          throw new DealRiskExplanationInputError();
        }
        return { value, usage: completion.usage };
      },
    });
  }
}

export const DEAL_RISK_EXPLANATION_OUTPUT_SCHEMA = MEETING_DRAFT_SCHEMA_VERSION;
export const DEAL_RISK_EXPLANATION_PROMPT_VERSION =
  "deal-risk-explanation." + MEETING_DRAFT_PROMPT_VERSION;

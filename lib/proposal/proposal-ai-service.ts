import type { OpenAiCompatibleClient } from "../ai/openai-compatible-client";
import { AiOutputValidationError, buildIsolatedPrompt, validateAiInput } from "../ai/safety-policy";
import {
  DEFAULT_PROPOSAL_SECTION_DEFINITIONS,
  PROPOSAL_AI_CAPABILITY,
  PROPOSAL_AI_PROMPT_VERSION,
  PROPOSAL_AI_SCHEMA_VERSION,
  parseProposalAiOutput,
} from "./contracts";

const ALLOWED_FIELDS = ["opportunity", "customer", "meetingNotes", "products", "templateSections"] as const;

export type ProposalAiGrounding = {
  opportunity: Record<string, unknown>;
  customer: Record<string, unknown>;
  meetingNotes: Array<Record<string, unknown>>;
  products: Array<Record<string, unknown>>;
  templateSections: Array<Record<string, unknown>>;
};

export function proposalSystemInstruction() {
  const required = DEFAULT_PROPOSAL_SECTION_DEFINITIONS.map(([code, title], sortOrder) => `${sortOrder}:${code}:${title}`).join("\n");
  return [
    `Return one JSON object with schemaVersion exactly ${PROPOSAL_AI_SCHEMA_VERSION} and a sections array.`,
    "Use only supplied facts. Do not invent customer claims, prices, dates, contractual commitments, approvals, SLAs, or technical feasibility.",
    "When evidence is missing, state that it requires confirmation. Keep pricing narrative non-binding and preserve supplied currency/amount strings exactly.",
    "Write professional enterprise-sales content. Thai or English may be used according to the supplied source language.",
    "Each section must have only sectionCode, title, sortOrder, contentType, content, structuredData.",
    "contentType must be RICH_TEXT and structuredData must be null. Return JSON only with no markdown fence or extra fields.",
    `Return each required section exactly once:\n${required}`,
  ].join("\n");
}

export class ProposalAiService {
  constructor(private readonly client: OpenAiCompatibleClient) {}

  async generate(grounding: ProposalAiGrounding) {
    const validated = validateAiInput({
      capability: PROPOSAL_AI_CAPABILITY,
      policy: { capability: PROPOSAL_AI_CAPABILITY, allowedFields: ALLOWED_FIELDS, requiredFields: ["opportunity", "customer"], maxCharacters: 80_000 },
      input: grounding,
      authorizedFields: new Set(ALLOWED_FIELDS),
    });
    const completion = await this.client.createChatCompletion(buildIsolatedPrompt({ systemInstruction: proposalSystemInstruction(), validatedInput: validated }));
    let payload: unknown;
    try { payload = JSON.parse(completion.content); } catch { throw new AiOutputValidationError(); }
    try {
      return { output: parseProposalAiOutput(payload), usage: completion.usage, providerModel: completion.providerModel };
    } catch {
      throw new AiOutputValidationError();
    }
  }
}

export { PROPOSAL_AI_PROMPT_VERSION };

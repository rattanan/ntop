import type { OpenAiCompatibleClient } from "../ai/openai-compatible-client";
import { AiOutputValidationError, buildIsolatedPrompt, validateAiInput } from "../ai/safety-policy";
import {
  DEFAULT_PROPOSAL_SECTION_DEFINITIONS,
  PROPOSAL_AI_CAPABILITY,
  PROPOSAL_AI_PROMPT_VERSION,
  PROPOSAL_AI_SCHEMA_VERSION,
  THAI_PROPOSAL_SECTION_TITLES,
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
  const required = DEFAULT_PROPOSAL_SECTION_DEFINITIONS.map(([code], sortOrder) => `${sortOrder}:${code}:${THAI_PROPOSAL_SECTION_TITLES[code]}`).join("\n");
  return [
    `Return one JSON object with schemaVersion exactly ${PROPOSAL_AI_SCHEMA_VERSION} and a sections array.`,
    "Use only supplied facts. Do not invent customer claims, prices, dates, contractual commitments, approvals, SLAs, or technical feasibility.",
    "เขียน title และ content ของทุก section เป็นภาษาไทยเชิงธุรกิจที่สุภาพ ชัดเจน และพร้อมให้ผู้ใช้ตรวจแก้ โดยทุก content ต้องมีข้อความภาษาไทย แม้ข้อมูลต้นทางเป็นภาษาอังกฤษ",
    "คงชื่อบุคคล ชื่อบริษัท ชื่อผลิตภัณฑ์หรือบริการ รหัส รุ่น คำย่อ สกุลเงิน จำนวนเงิน วันที่ และข้อความอ้างอิงตามข้อมูลต้นฉบับ ห้ามแปลหรือเปลี่ยนค่าดังกล่าว",
    "เมื่อหลักฐานไม่เพียงพอ ให้ระบุเป็นภาษาไทยว่าต้องยืนยันข้อมูลเพิ่มเติม ห้ามแต่งข้อเท็จจริง และให้ข้อความด้านราคาเป็นข้อมูลเบื้องต้นที่ไม่มีผลผูกพัน",
    "Use the exact Thai title listed for each section. Keep JSON property names, schemaVersion, sectionCode, and contentType exactly as specified.",
    "Each section must have only sectionCode, title, sortOrder, contentType, content, structuredData.",
    "contentType must be RICH_TEXT and structuredData must be null. Return JSON only with no markdown fence or extra fields.",
    `Return each required section exactly once:\n${required}`,
  ].join("\n");
}

const THAI_CHARACTER_PATTERN = /[\u0E00-\u0E7F]/;

export function parseThaiProposalAiOutput(value: unknown) {
  const parsed = parseProposalAiOutput(value);
  if (parsed.sections.some((section) => !THAI_CHARACTER_PATTERN.test(section.content))) {
    throw new AiOutputValidationError();
  }
  return {
    ...parsed,
    sections: parsed.sections.map((section) => {
      const title = THAI_PROPOSAL_SECTION_TITLES[section.sectionCode as keyof typeof THAI_PROPOSAL_SECTION_TITLES];
      if (!title) throw new AiOutputValidationError();
      return { ...section, title };
    }),
  };
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
      return { output: parseThaiProposalAiOutput(payload), usage: completion.usage, providerModel: completion.providerModel };
    } catch {
      throw new AiOutputValidationError();
    }
  }
}

export { PROPOSAL_AI_PROMPT_VERSION };

import { describe, expect, it } from "vitest";

import { AiOutputValidationError } from "../../lib/ai/safety-policy";
import {
  PROPOSAL_AI_PROMPT_VERSION,
  PROPOSAL_AI_SCHEMA_VERSION,
  THAI_PROPOSAL_SECTION_TITLES,
  defaultProposalSections,
} from "../../lib/proposal/contracts";
import { parseThaiProposalAiOutput, proposalSystemInstruction } from "../../lib/proposal/proposal-ai-service";

function outputWithContent(content: string) {
  return {
    schemaVersion: PROPOSAL_AI_SCHEMA_VERSION,
    sections: defaultProposalSections().map((section) => ({ ...section, content })),
  };
}

describe("Thai AI Proposal generation", () => {
  it("uses a versioned Thai-only instruction while preserving source identifiers and values", () => {
    const instruction = proposalSystemInstruction();

    expect(PROPOSAL_AI_PROMPT_VERSION).toBe("proposal-generation.prompt.v2-th");
    expect(instruction).toContain("ทุก content ต้องมีข้อความภาษาไทย");
    expect(instruction).toContain("คงชื่อบุคคล ชื่อบริษัท ชื่อผลิตภัณฑ์หรือบริการ รหัส รุ่น คำย่อ สกุลเงิน จำนวนเงิน วันที่");
    expect(instruction).toContain(THAI_PROPOSAL_SECTION_TITLES.EXECUTIVE_SUMMARY);
    expect(instruction).not.toContain("Thai or English may be used according to the supplied source language");
  });

  it("normalizes every section title to Thai before persisting the AI draft", () => {
    const parsed = parseThaiProposalAiOutput(outputWithContent("ต้องยืนยันข้อมูลเพิ่มเติมกับลูกค้าก่อนจัดทำข้อเสนอฉบับสมบูรณ์"));

    expect(parsed.sections[0].title).toBe(THAI_PROPOSAL_SECTION_TITLES.EXECUTIVE_SUMMARY);
    expect(parsed.sections.at(-1)?.title).toBe(THAI_PROPOSAL_SECTION_TITLES.NEXT_STEPS);
  });

  it("rejects an English-only Proposal instead of saving it", () => {
    expect(() => parseThaiProposalAiOutput(outputWithContent("Additional confirmation is required."))).toThrow(AiOutputValidationError);
  });
});

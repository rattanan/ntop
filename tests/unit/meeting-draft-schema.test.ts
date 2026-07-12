import { describe, expect, it } from "vitest";

import { AiOutputValidationError } from "../../lib/ai/safety-policy";
import {
  MEETING_DRAFT_PROMPT_VERSION,
  MEETING_DRAFT_SCHEMA_VERSION,
  meetingDraftSystemInstruction,
  parseMeetingDraftOutput,
} from "../../lib/ai/meeting-draft-schema";

const emptyDraft = {
  schemaVersion: MEETING_DRAFT_SCHEMA_VERSION,
  meetingSummary: "",
  keyRequirements: [],
  decisionsAndAgreements: [],
  actionItems: [],
  risksAndConcerns: [],
  suggestedNextAction: null,
  suggestedActivity: null,
};

describe("Meeting Draft v1 schema", () => {
  it("accepts a Thai fixture with explicit timezone dates", () => {
    expect(
      parseMeetingDraftOutput({
        ...emptyDraft,
        meetingSummary: "ลูกค้าต้องการวงจรสำรองสำหรับสำนักงานใหญ่",
        keyRequirements: ["วงจรสำรองต้องแยกเส้นทาง"],
        decisionsAndAgreements: ["นัดสำรวจพื้นที่สัปดาห์หน้า"],
        actionItems: [
          {
            description: "ส่งข้อมูลสถานที่ติดตั้ง",
            suggestedOwner: "ผู้ประสานงานลูกค้า",
            suggestedDueAt: "2026-07-15T17:00:00+07:00",
          },
        ],
        risksAndConcerns: ["ยังไม่ยืนยันเส้นทาง Fiber"],
      }),
    ).toMatchObject({ schemaVersion: "meeting-draft.v1" });
  });

  it("accepts an English fixture and preserves unknowns as empty", () => {
    expect(
      parseMeetingDraftOutput({
        ...emptyDraft,
        meetingSummary: "Customer requested a resilient branch connection.",
      }),
    ).toEqual({
      ...emptyDraft,
      meetingSummary: "Customer requested a resilient branch connection.",
    });
  });

  it.each([
    { ...emptyDraft, opportunityStage: "WON" },
    { ...emptyDraft, generatedQuote: { total: 1 } },
    { ...emptyDraft, schemaVersion: "meeting-draft.v2" },
    {
      ...emptyDraft,
      actionItems: [
        {
          description: "Follow up",
          suggestedOwner: null,
          suggestedDueAt: "2026-07-15T10:00:00",
        },
      ],
    },
  ])("rejects out-of-scope, unknown or timezone-ambiguous output", (output) => {
    expect(() => parseMeetingDraftOutput(output)).toThrow(
      AiOutputValidationError,
    );
  });
});

describe("Meeting Draft v1 prompt", () => {
  it("is versioned and states the human-draft boundaries", () => {
    const instruction = meetingDraftSystemInstruction();

    expect(MEETING_DRAFT_PROMPT_VERSION).toBe("meeting-draft.prompt.v1");
    expect(instruction).toContain("This is a Draft");
    expect(instruction).toContain("Never create or mutate");
    expect(instruction).toContain("Do not guess");
    expect(instruction).toContain("explicit timezone offset");
  });
});

import { describe, expect, it } from "vitest";

import { createLegacyMeetingDraft } from "../../lib/ai/legacy-meeting-draft";

describe("legacy meeting draft", () => {
  it("preserves the first-two-sentences summary behavior", () => {
    expect(
      createLegacyMeetingDraft("ประโยคแรก. ประโยคที่สอง! ประโยคที่สาม?"),
    ).toEqual({
      summary: "ประโยคแรก. ประโยคที่สอง!",
      actionItems: "ยังไม่มี Action Item ที่ระบุ",
    });
  });

  it("preserves recognized action-item prefixes and line order", () => {
    const draft = createLegacyMeetingDraft(
      "สรุปการประชุม\nส่ง Proposal วันศุกร์\nTODO นัดหมายครั้งถัดไป\nข้อมูลทั่วไป",
    );

    expect(draft.actionItems).toBe(
      "ส่ง Proposal วันศุกร์\nTODO นัดหมายครั้งถัดไป",
    );
  });

  it("preserves empty-note fallback messages", () => {
    expect(createLegacyMeetingDraft("")).toEqual({
      summary: "รอรายละเอียดการประชุม",
      actionItems: "ยังไม่มี Action Item ที่ระบุ",
    });
  });
});

import { describe, expect, it } from "vitest";

import { buildDealRiskRefreshFeedback } from "../../lib/ai/deal-risk-refresh-feedback";

describe("Deal Risk refresh feedback", () => {
  it("explains that an active rule is required before signals can be created", () => {
    expect(
      buildDealRiskRefreshFeedback({ evaluatedRuleCount: 0, signalCount: 0 }),
    ).toEqual({
      message:
        "ยังไม่มี Risk Rule ที่เปิดใช้งาน จึงไม่สามารถสร้าง Risk Signal ได้ กรุณาให้ผู้ดูแลระบบตั้งค่า Risk Rules",
      status: "warning",
    });
  });

  it("confirms a successful evaluation when no rule condition matches", () => {
    expect(
      buildDealRiskRefreshFeedback({ evaluatedRuleCount: 3, signalCount: 0 }),
    ).toEqual({
      message: "ประเมิน Risk Rule 3 กฎแล้ว ไม่พบความเสี่ยงที่เข้าเงื่อนไข",
      status: "success",
    });
  });

  it("reports the number of persisted signals", () => {
    expect(
      buildDealRiskRefreshFeedback({ evaluatedRuleCount: 3, signalCount: 2 }),
    ).toEqual({
      message: "ประเมิน Risk Rule 3 กฎแล้ว พบ Risk Signal 2 รายการ",
      status: "success",
    });
  });
});

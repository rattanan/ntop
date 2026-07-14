import { describe, expect, it } from "vitest";

import { calculateOpportunityHealth } from "../../lib/opportunity/opportunity-health";

const now = new Date("2026-07-14T12:00:00Z");

describe("calculateOpportunityHealth", () => {
  it("returns an explainable healthy score for a complete active opportunity", () => {
    const result = calculateOpportunityHealth({
      stage: "NEGOTIATION", lastActivityAt: new Date("2026-07-13T12:00:00Z"), nextAction: "Customer decision meeting",
      qualificationResult: "Qualified", requirements: "Confirmed", stakeholderSummary: "Economic buyer confirmed",
      solutionComplete: true, commercialReady: true, expectedCloseAt: new Date("2026-08-01T00:00:00Z"),
    }, now);
    expect(result).toMatchObject({ score: 100, category: "HEALTHY", risks: [] });
    expect(result.positives).toContain("มีกิจกรรมล่าสุดกับลูกค้า");
  });

  it("identifies stale and incomplete opportunity risks deterministically", () => {
    const result = calculateOpportunityHealth({
      stage: "DISCOVER", lastActivityAt: new Date("2026-06-01T00:00:00Z"), nextAction: null,
      qualificationResult: null, requirements: null, stakeholderSummary: null,
      solutionComplete: false, commercialReady: false, expectedCloseAt: new Date("2026-07-01T00:00:00Z"),
    }, now);
    expect(result.category).toBe("CRITICAL");
    expect(result.risks).toContain("ไม่มีกิจกรรมใน 14 วันที่ผ่านมา");
    expect(result.risks).toContain("Expected close date เกินกำหนด");
  });

  it("accepts configurable freshness and stage weights", () => {
    const result = calculateOpportunityHealth({ stage: "QUALIFY", lastActivityAt: new Date("2026-07-10T00:00:00Z"), nextAction: null, qualificationResult: null, requirements: null, stakeholderSummary: null, solutionComplete: false, commercialReady: false, expectedCloseAt: null }, now, {
      activityFreshDays: 3,
      stageScores: { QUALIFY: 40, DISCOVER: 40, SOLUTION: 40, PROPOSAL: 40, NEGOTIATION: 40, WON: 40, LOST: 0, CANCELLED: 0, EXPIRED: 0 },
    });
    expect(result.score).toBe(40);
    expect(result.category).toBe("AT_RISK");
  });
});

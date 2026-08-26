import { describe, expect, it } from "vitest";

import { getOpportunityWorkflowPathStages } from "../../lib/opportunity/opportunity-workflow-path";

describe("Opportunity workflow path", () => {
  it("shows Lost in step 6 instead of Won for a lost opportunity", () => {
    const stages = getOpportunityWorkflowPathStages("LOST");

    expect(stages).toHaveLength(6);
    expect(stages[5]).toEqual(["LOST", "ไม่ชนะ"]);
    expect(stages.some(([value]) => value === "WON")).toBe(false);
  });

  it("keeps Won in step 6 for a won opportunity", () => {
    const stages = getOpportunityWorkflowPathStages("WON");

    expect(stages).toHaveLength(6);
    expect(stages[5]).toEqual(["WON", "ชนะ"]);
  });
});

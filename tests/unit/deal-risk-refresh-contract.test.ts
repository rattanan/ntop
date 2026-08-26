import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const page = readFileSync(
  "app/(portal)/opportunities/[id]/page.tsx",
  "utf8",
);
const panel = readFileSync("components/deal-risk-panel.tsx", "utf8");
const action = readFileSync("app/actions/ai-risk.ts", "utf8");

describe("Deal Risk refresh UI contract", () => {
  it("does not present persistence failures as an empty signal list", () => {
    expect(page).not.toContain(
      "listOpportunityRiskSignals(prisma,id).catch(()=>[])",
    );
    expect(page).toContain("riskPersistenceAvailable={riskSignalResult.available}");
    expect(panel).toContain('riskPersistenceAvailable && (');
    expect(panel).toContain('Notice variant="error"');
  });

  it("announces refresh outcomes through the shared accessible notice", () => {
    expect(panel).toContain("<FormNotice state={state} />");
    expect(action).toContain("buildDealRiskRefreshFeedback(result)");
    expect(action).toContain('status: "error"');
    expect(action).toContain("Correlation ID:");
  });
});

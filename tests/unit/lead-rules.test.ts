import { describe, expect, it } from "vitest";
import { calculateLeadScore, canTransition, evaluateQualification, firstContactDueAt, formatLeadNumber, normalizeDuplicateText } from "../../lib/lead/lead-rules";

describe("lead workflow rules", () => {
  it("allows configured transitions and rejects invalid shortcuts", () => {
    expect(canTransition("NEW", "ASSIGNED")).toBe(true);
    expect(canTransition("ASSIGNED", "QUALIFIED")).toBe(false);
    expect(canTransition("CONVERTED", "CONTACTED")).toBe(false);
  });

  it("calculates a capped score with an explainable temperature", () => {
    const now = new Date("2026-07-14T00:00:00.000Z");
    const result = calculateLeadScore({ taxId: "123", email: "sales@nt.co.th", estimatedBudget: "100000", expectedPurchaseAt: new Date("2026-08-01T00:00:00.000Z"), decisionMakerKnown: true, strategicProduct: true, numberOfSites: 3 }, now);
    expect(result).toMatchObject({ score: 85, temperature: "HOT" });
    expect(result.breakdown.map((item) => item.rule)).toContain("budget");
  });

  it("reports qualification completeness and missing evidence", () => {
    const result = evaluateQualification({ need: true, serviceArea: true, budget: true, authority: true });
    expect(result.completeness).toBe(50);
    expect(result.missing).toContain("verifiedContact");
  });

  it("normalizes common legal suffixes for duplicate checks", () => {
    expect(normalizeDuplicateText("บริษัท เอ็นที จำกัด (มหาชน)")).toBe(normalizeDuplicateText("เอ็นที PLC"));
  });

  it("uses the centralized SLA configuration", () => {
    expect(firstContactDueAt(new Date("2026-07-14T00:00:00Z"), "HOT").toISOString()).toBe("2026-07-14T04:00:00.000Z");
  });
  it("formats an auditable running Lead number in Bangkok year",()=>{expect(formatLeadNumber(42,new Date("2026-07-14T00:00:00Z"))).toBe("LD-2026-0000042");});
});

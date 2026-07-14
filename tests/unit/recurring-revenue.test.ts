import { describe, expect, it } from "vitest";

import { createRecurringRevenueSchedule } from "../../lib/forecast/recurring-revenue";

describe("createRecurringRevenueSchedule", () => {
  it("creates an MRR schedule without treating annual revenue as TCV", () => {
    const result = createRecurringRevenueSchedule({ monthlyRecurringRevenue: "100000", expectedActivationAt: new Date("2026-09-30T17:00:00Z"), contractDurationMonths: 12, timezone: "Asia/Bangkok" });
    expect(result.periods[0]?.period).toBe("2026-10");
    expect(result.periods.at(-1)?.period).toBe("2027-09");
    expect(result.annualRecurringRevenue.toFixed(4)).toBe("1200000.0000");
    expect(result.totalContractRecurringRevenue.toFixed(4)).toBe("1200000.0000");
  });

  it("keeps multi-year contract value separate from ARR", () => {
    const result = createRecurringRevenueSchedule({ monthlyRecurringRevenue: "100", expectedActivationAt: new Date("2026-01-01T00:00:00Z"), contractDurationMonths: 24, timezone: "UTC" });
    expect(result.annualRecurringRevenue.toFixed(4)).toBe("1200.0000");
    expect(result.totalContractRecurringRevenue.toFixed(4)).toBe("2400.0000");
  });
});

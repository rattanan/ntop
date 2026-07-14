import { describe, expect, it } from "vitest";

import { resolveFiscalPeriod } from "../../lib/forecast/fiscal-period";

const config = { fiscalYearStartMonth: 10, timezone: "Asia/Bangkok", currency: "THB", reportingCutoffHour: 17 };

describe("resolveFiscalPeriod", () => {
  it("maps a date into configurable fiscal month, quarter and ending year", () => {
    const result = resolveFiscalPeriod(new Date("2026-11-15T00:00:00Z"), "QUARTER", config);
    expect(result.fiscalYear).toBe(2027);
    expect(result.fiscalQuarter).toBe(1);
    expect(result.fiscalMonth).toBe(2);
    expect(result.periodStart.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(result.periodEnd.toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });

  it("supports a standard calendar without assuming UTC local dates", () => {
    const result = resolveFiscalPeriod(new Date("2026-07-14T12:00:00Z"), "MONTH", { ...config, fiscalYearStartMonth: 1 });
    expect(result.fiscalYear).toBe(2026);
    expect(result.fiscalMonth).toBe(7);
    expect(result.periodStart.toISOString()).toBe("2026-06-30T17:00:00.000Z");
    expect(result.periodEnd.toISOString()).toBe("2026-07-31T17:00:00.000Z");
  });
});

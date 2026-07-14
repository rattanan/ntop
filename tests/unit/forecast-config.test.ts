import { describe, expect, it } from "vitest";

import { loadForecastConfig } from "../../lib/forecast/forecast-config";

describe("loadForecastConfig", () => {
  it("uses the NT development defaults in one configuration boundary", () => {
    expect(loadForecastConfig({})).toEqual({ fiscalYearStartMonth: 1, timezone: "Asia/Bangkok", currency: "THB", reportingCutoffHour: 17 });
  });

  it("supports an organization-specific fiscal year and timezone", () => {
    expect(loadForecastConfig({ FORECAST_FISCAL_YEAR_START_MONTH: "10", FORECAST_TIMEZONE: "UTC", FORECAST_CURRENCY: "USD", FORECAST_REPORTING_CUTOFF_HOUR: "18" })).toEqual({ fiscalYearStartMonth: 10, timezone: "UTC", currency: "USD", reportingCutoffHour: 18 });
  });

  it("rejects invalid configuration", () => {
    expect(() => loadForecastConfig({ FORECAST_FISCAL_YEAR_START_MONTH: "13" })).toThrow();
  });
});

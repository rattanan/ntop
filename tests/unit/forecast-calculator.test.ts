import { describe, expect, it } from "vitest";

import {
  calculateForecast,
  calculateForecastAccuracy,
  calculatePipelineVelocity,
  calculateSalesPerformance,
  calculateTargetMetrics,
} from "../../lib/forecast/forecast-calculator";

const base = { opportunityVersion: 1, ownerId: "u", organizationUnitId: null, customerId: "c", segment: "B1", flow: "F1", stage: "PROPOSAL" as const, amountSource: "OPPORTUNITY" as const, sourceQuoteVersionId: null, expectedCloseAt: new Date("2026-08-01Z"), stageEnteredAt: new Date("2026-07-01Z"), riskSnapshot: {}, qualitySnapshot: {} };

describe("calculateForecast", () => {
  it("matches the approved weighted-pipeline vector", () => {
    const result = calculateForecast([
      { ...base, opportunityId: "A", category: "COMMIT", estimatedValue: "1000000.00", forecastAmount: "1000000.00", probability: 80 },
      { ...base, opportunityId: "B", category: "BEST_CASE", estimatedValue: "500000.00", forecastAmount: "500000.00", probability: 40 },
      { ...base, opportunityId: "C", category: "PIPELINE", estimatedValue: "250000.00", forecastAmount: "250000.00", probability: 0 },
    ]);
    expect(result.pipelineAmount.toFixed(4)).toBe("1750000.0000");
    expect(result.weightedAmount.toFixed(4)).toBe("1000000.0000");
    expect(result.commitAmount.toFixed(4)).toBe("1000000.0000");
    expect(result.bestCaseAmount.toFixed(4)).toBe("1500000.0000");
  });

  it("excludes omitted and terminal records from active pipeline by default", () => {
    const facts = [
      { ...base, opportunityId: "active", category: "PIPELINE" as const, estimatedValue: "100", forecastAmount: "100", probability: 50 },
      { ...base, opportunityId: "omitted", category: "OMITTED" as const, estimatedValue: "200", forecastAmount: "200", probability: 50 },
      { ...base, opportunityId: "won", stage: "WON" as const, category: "COMMIT" as const, estimatedValue: "300", forecastAmount: "300", probability: 100 },
    ];
    expect(calculateForecast(facts).pipelineAmount.toFixed(4)).toBe("100.0000");
    expect(calculateForecast(facts, { includeOmitted: true }).pipelineAmount.toFixed(4)).toBe("300.0000");
  });
});

describe("forecast business metrics", () => {
  it("calculates attainment, remaining target and coverage without floating point", () => {
    const result = calculateTargetMetrics({ salesTarget: "100000000", actualClosedWon: "60000000", currentForecast: "90000000", openPipeline: "120000000" });
    expect(result.remainingTarget.toFixed(4)).toBe("40000000.0000");
    expect(result.targetAttainmentPercent?.toFixed(4)).toBe("60.0000");
    expect(result.forecastAttainmentPercent?.toFixed(4)).toBe("90.0000");
    expect(result.pipelineCoverage?.toFixed(4)).toBe("3.0000");
  });

  it("returns explicit null ratios for zero denominators", () => {
    const result = calculateTargetMetrics({ salesTarget: "0", actualClosedWon: "0", currentForecast: "0", openPipeline: "10" });
    expect(result.targetAttainmentPercent).toBeNull();
    expect(result.forecastAttainmentPercent).toBeNull();
    expect(result.pipelineCoverage).toBeNull();
  });

  it("calculates win rate, deal size, sales cycle and modular velocity", () => {
    const result = calculateSalesPerformance([
      { outcome: "WON", amount: "1000", createdAt: new Date("2026-01-01T00:00:00Z"), closedAt: new Date("2026-01-11T00:00:00Z") },
      { outcome: "LOST", amount: "500", createdAt: new Date("2026-01-01T00:00:00Z"), closedAt: new Date("2026-01-21T00:00:00Z") },
    ]);
    expect(result.winRatePercent?.toFixed(4)).toBe("50.0000");
    expect(result.averageDealSize?.toFixed(4)).toBe("750.0000");
    expect(result.averageSalesCycleDays?.toFixed(4)).toBe("15.0000");
    expect(calculatePipelineVelocity({ qualifiedOpportunityCount: 4, averageDealSize: "750", winRatePercent: "50", averageSalesCycleDays: "15" })?.toFixed(4)).toBe("100.0000");
  });

  it("calculates forecast accuracy and bias and handles zero actual", () => {
    const result = calculateForecastAccuracy({ forecast: "120", actual: "100" });
    expect(result.accuracyPercent?.toFixed(4)).toBe("80.0000");
    expect(result.bias.toFixed(4)).toBe("20.0000");
    expect(calculateForecastAccuracy({ forecast: "10", actual: "0" }).accuracyPercent).toBeNull();
  });
});

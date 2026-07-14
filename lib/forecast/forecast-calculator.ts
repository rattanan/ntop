import type { ForecastCategory, OpportunityStage } from "@prisma/client";

import { decimal, money, ZERO, type DecimalInput } from "../commercial/decimal-money";

export type PipelineFact = {
  opportunityId: string;
  opportunityNumber?: string | null;
  opportunityName?: string;
  opportunityVersion: number;
  ownerId: string;
  ownerName?: string;
  organizationUnitId: string | null;
  customerId: string;
  customerName?: string;
  segment: string;
  flow: string;
  stage: OpportunityStage;
  category: ForecastCategory;
  estimatedValue: DecimalInput;
  forecastAmount: DecimalInput;
  probability: number;
  amountSource: "OPPORTUNITY" | "QUOTE_VERSION";
  sourceQuoteVersionId: string | null;
  expectedCloseAt: Date | null;
  stageEnteredAt: Date;
  riskSnapshot: Record<string, unknown>;
  qualitySnapshot: Record<string, unknown>;
};

export class ForecastCalculationError extends Error {
  constructor() {
    super("Forecast facts are invalid.");
    this.name = "ForecastCalculationError";
  }
}

export type ForecastCalculationOptions = {
  includeOmitted?: boolean;
};

const terminalStages: readonly OpportunityStage[] = ["WON", "LOST", "CANCELLED"];

export function calculateForecast(
  facts: readonly PipelineFact[],
  options: ForecastCalculationOptions = {},
) {
  const items = facts.map((fact) => {
    if (!Number.isInteger(fact.probability) || fact.probability < 0 || fact.probability > 100) {
      throw new ForecastCalculationError();
    }
    const estimatedValue = money(fact.estimatedValue);
    const forecastAmount = money(fact.forecastAmount);
    if (estimatedValue.lt(0) || forecastAmount.lt(0)) throw new ForecastCalculationError();
    return {
      ...fact,
      estimatedValue,
      forecastAmount,
      weightedAmount: money(
        forecastAmount.mul(decimal(fact.probability)).div(100),
      ),
    };
  });
  const activeItems = items.filter(
    (item) =>
      !terminalStages.includes(item.stage) &&
      (options.includeOmitted === true || item.category !== "OMITTED"),
  );
  const commitItems = activeItems.filter((item) => item.category === "COMMIT");
  const bestCaseItems = activeItems.filter(
    (item) => item.category === "COMMIT" || item.category === "BEST_CASE",
  );
  return {
    items,
    pipelineAmount: sumMoney(activeItems.map((item) => item.forecastAmount)),
    weightedAmount: sumMoney(activeItems.map((item) => item.weightedAmount)),
    commitAmount: sumMoney(commitItems.map((item) => item.forecastAmount)),
    bestCaseAmount: sumMoney(bestCaseItems.map((item) => item.forecastAmount)),
  };
}

function sumMoney(values: readonly DecimalInput[]) {
  return money(values.reduce<ReturnType<typeof decimal>>((sum, value) => sum.plus(decimal(value)), ZERO));
}

function safePercent(numerator: DecimalInput, denominator: DecimalInput) {
  const divisor = decimal(denominator);
  return divisor.eq(0) ? null : decimal(numerator).div(divisor).mul(100).toDecimalPlaces(4);
}

export function calculateTargetMetrics(input: {
  salesTarget: DecimalInput;
  actualClosedWon: DecimalInput;
  currentForecast: DecimalInput;
  openPipeline: DecimalInput;
}) {
  const salesTarget = money(input.salesTarget);
  const actualClosedWon = money(input.actualClosedWon);
  const currentForecast = money(input.currentForecast);
  const openPipeline = money(input.openPipeline);
  if ([salesTarget, actualClosedWon, currentForecast, openPipeline].some((value) => value.lt(0))) {
    throw new ForecastCalculationError();
  }
  const remainingTarget = money(PrismaDecimalMax(salesTarget.minus(actualClosedWon), ZERO));
  return {
    salesTarget,
    actualClosedWon,
    currentForecast,
    openPipeline,
    remainingTarget,
    targetAttainmentPercent: safePercent(actualClosedWon, salesTarget),
    forecastAttainmentPercent: safePercent(currentForecast, salesTarget),
    pipelineCoverage: remainingTarget.eq(0)
      ? null
      : openPipeline.div(remainingTarget).toDecimalPlaces(4),
  };
}

function PrismaDecimalMax(left: ReturnType<typeof decimal>, right: ReturnType<typeof decimal>) {
  return left.greaterThan(right) ? left : right;
}

export type ClosedOpportunityFact = {
  outcome: "WON" | "LOST";
  amount: DecimalInput;
  createdAt: Date;
  closedAt: Date;
};

export function calculateSalesPerformance(facts: readonly ClosedOpportunityFact[]) {
  for (const fact of facts) {
    if (money(fact.amount).lt(0) || fact.closedAt < fact.createdAt) {
      throw new ForecastCalculationError();
    }
  }
  const won = facts.filter((fact) => fact.outcome === "WON");
  const closedCount = facts.length;
  const totalRevenue = sumMoney(facts.map((fact) => fact.amount));
  const wonRevenue = sumMoney(won.map((fact) => fact.amount));
  const totalCycleDays = facts.reduce(
    (sum, fact) => sum.plus(decimal(fact.closedAt.getTime() - fact.createdAt.getTime()).div(86_400_000)),
    ZERO,
  );
  return {
    wonCount: won.length,
    lostCount: closedCount - won.length,
    wonRevenue,
    totalRevenue,
    winRatePercent: closedCount === 0 ? null : decimal(won.length).div(closedCount).mul(100).toDecimalPlaces(4),
    averageDealSize: closedCount === 0 ? null : money(totalRevenue.div(closedCount)),
    averageSalesCycleDays: closedCount === 0 ? null : totalCycleDays.div(closedCount).toDecimalPlaces(4),
  };
}

export function calculatePipelineVelocity(input: {
  qualifiedOpportunityCount: number;
  averageDealSize: DecimalInput;
  winRatePercent: DecimalInput;
  averageSalesCycleDays: DecimalInput;
}) {
  if (!Number.isInteger(input.qualifiedOpportunityCount) || input.qualifiedOpportunityCount < 0) {
    throw new ForecastCalculationError();
  }
  const averageDealSize = money(input.averageDealSize);
  const winRatePercent = decimal(input.winRatePercent);
  const averageSalesCycleDays = decimal(input.averageSalesCycleDays);
  if (averageDealSize.lt(0) || winRatePercent.lt(0) || winRatePercent.gt(100) || averageSalesCycleDays.lt(0)) {
    throw new ForecastCalculationError();
  }
  if (averageSalesCycleDays.eq(0)) return null;
  return money(
    decimal(input.qualifiedOpportunityCount)
      .mul(averageDealSize)
      .mul(winRatePercent.div(100))
      .div(averageSalesCycleDays),
  );
}

export function calculateForecastAccuracy(input: {
  forecast: DecimalInput;
  actual: DecimalInput;
}) {
  const forecast = money(input.forecast);
  const actual = money(input.actual);
  if (forecast.lt(0) || actual.lt(0)) throw new ForecastCalculationError();
  const bias = money(forecast.minus(actual));
  return {
    forecast,
    actual,
    bias,
    variance: bias,
    accuracyPercent: actual.eq(0)
      ? null
      : decimal(1).minus(forecast.minus(actual).abs().div(actual)).mul(100).toDecimalPlaces(4),
  };
}

export function aggregatePipeline(
  facts: readonly PipelineFact[],
  filters: Partial<Pick<PipelineFact, "ownerId" | "organizationUnitId" | "segment" | "flow" | "stage" | "category">>,
) {
  return calculateForecast(
    facts.filter((fact) =>
      Object.entries(filters).every(([key, value]) =>
        value === undefined || fact[key as keyof PipelineFact] === value,
      ),
    ),
  );
}

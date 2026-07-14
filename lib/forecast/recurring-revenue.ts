import { money, ZERO, type DecimalInput } from "../commercial/decimal-money";

export class RecurringRevenueError extends Error {
  constructor() {
    super("Recurring revenue schedule input is invalid.");
    this.name = "RecurringRevenueError";
  }
}

function localYearMonth(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(date);
    return {
      year: Number(parts.find((part) => part.type === "year")?.value),
      month: Number(parts.find((part) => part.type === "month")?.value),
    };
  } catch {
    throw new RecurringRevenueError();
  }
}

function monthKey(year: number, month: number) {
  const normalized = new Date(Date.UTC(year, month - 1, 1));
  return {
    year: normalized.getUTCFullYear(),
    month: normalized.getUTCMonth() + 1,
    key: `${normalized.getUTCFullYear()}-${String(normalized.getUTCMonth() + 1).padStart(2, "0")}`,
  };
}

export function createRecurringRevenueSchedule(input: {
  monthlyRecurringRevenue: DecimalInput;
  expectedActivationAt: Date;
  contractDurationMonths: number;
  timezone: string;
}) {
  const amount = money(input.monthlyRecurringRevenue);
  if (
    amount.lt(0) ||
    !Number.isFinite(input.expectedActivationAt.getTime()) ||
    !Number.isInteger(input.contractDurationMonths) ||
    input.contractDurationMonths < 1 ||
    input.contractDurationMonths > 1_200
  ) throw new RecurringRevenueError();
  const activation = localYearMonth(input.expectedActivationAt, input.timezone);
  const periods = Array.from({ length: input.contractDurationMonths }, (_, index) => {
    const current = monthKey(activation.year, activation.month + index);
    return { period: current.key, amount };
  });
  return {
    monthlyRecurringRevenue: amount,
    annualRecurringRevenue: money(amount.mul(12)),
    totalContractRecurringRevenue: money(
      periods.reduce((sum, period) => sum.plus(period.amount), ZERO),
    ),
    periods,
  };
}

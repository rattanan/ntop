export type FiscalCalendarConfig = {
  fiscalYearStartMonth: number;
  timezone: string;
  currency: string;
  reportingCutoffHour: number;
};

export type FiscalPeriodType = "MONTH" | "QUARTER" | "YEAR";

export class FiscalPeriodError extends Error {
  constructor() {
    super("Fiscal calendar configuration is invalid.");
    this.name = "FiscalPeriodError";
  }
}

function validate(config: FiscalCalendarConfig) {
  if (
    !Number.isInteger(config.fiscalYearStartMonth) ||
    config.fiscalYearStartMonth < 1 ||
    config.fiscalYearStartMonth > 12 ||
    !Number.isInteger(config.reportingCutoffHour) ||
    config.reportingCutoffHour < 0 ||
    config.reportingCutoffHour > 23 ||
    !/^[A-Z]{3}$/.test(config.currency)
  ) throw new FiscalPeriodError();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: config.timezone }).format(new Date());
  } catch {
    throw new FiscalPeriodError();
  }
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour") };
}

function zonedDateTimeToUtc(year: number, month: number, day: number, hour: number, timezone: string) {
  const desired = Date.UTC(year, month - 1, day, hour);
  let candidate = desired;
  for (let index = 0; index < 3; index += 1) {
    const actual = zonedParts(new Date(candidate), timezone);
    const rendered = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour);
    candidate -= rendered - desired;
  }
  return new Date(candidate);
}

function normalizeMonth(year: number, month: number) {
  const normalized = new Date(Date.UTC(year, month - 1, 1));
  return { year: normalized.getUTCFullYear(), month: normalized.getUTCMonth() + 1 };
}

export function resolveFiscalPeriod(date: Date, type: FiscalPeriodType, config: FiscalCalendarConfig) {
  validate(config);
  if (!Number.isFinite(date.getTime())) throw new FiscalPeriodError();
  const local = zonedParts(date, config.timezone);
  const fiscalMonth = ((local.month - config.fiscalYearStartMonth + 12) % 12) + 1;
  const fiscalQuarter = Math.ceil(fiscalMonth / 3);
  const fiscalYear = config.fiscalYearStartMonth === 1
    ? local.year
    : local.month >= config.fiscalYearStartMonth ? local.year + 1 : local.year;
  const fiscalStartCalendarYear = config.fiscalYearStartMonth === 1 ? fiscalYear : fiscalYear - 1;
  const startOffset = type === "YEAR" ? 0 : type === "QUARTER" ? (fiscalQuarter - 1) * 3 : fiscalMonth - 1;
  const durationMonths = type === "YEAR" ? 12 : type === "QUARTER" ? 3 : 1;
  const startMonth = normalizeMonth(fiscalStartCalendarYear, config.fiscalYearStartMonth + startOffset);
  const endMonth = normalizeMonth(startMonth.year, startMonth.month + durationMonths);
  return {
    type,
    fiscalYear,
    fiscalQuarter,
    fiscalMonth,
    timezone: config.timezone,
    currency: config.currency,
    periodStart: zonedDateTimeToUtc(startMonth.year, startMonth.month, 1, 0, config.timezone),
    periodEnd: zonedDateTimeToUtc(endMonth.year, endMonth.month, 1, 0, config.timezone),
    reportingCutoffAt: zonedDateTimeToUtc(endMonth.year, endMonth.month, 1, config.reportingCutoffHour, config.timezone),
  };
}

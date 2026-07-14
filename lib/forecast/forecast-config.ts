import { FiscalPeriodError, type FiscalCalendarConfig } from "./fiscal-period";

type ForecastEnvironment = Record<string, string | undefined>;

export function loadForecastConfig(environment: ForecastEnvironment = process.env): FiscalCalendarConfig {
  const config = {
    fiscalYearStartMonth: Number(environment.FORECAST_FISCAL_YEAR_START_MONTH ?? "1"),
    timezone: environment.FORECAST_TIMEZONE ?? "Asia/Bangkok",
    currency: environment.FORECAST_CURRENCY ?? "THB",
    reportingCutoffHour: Number(environment.FORECAST_REPORTING_CUTOFF_HOUR ?? "17"),
  };
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
  return config;
}

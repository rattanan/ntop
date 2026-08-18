import { z } from "zod";

export const DASHBOARD_FILTER_KEYS = [
  "from",
  "to",
  "departmentId",
  "teamId",
  "ownerId",
  "segment",
  "productId",
  "status",
] as const;

export type DashboardFilters = {
  from?: string;
  to?: string;
  departmentId?: string;
  teamId?: string;
  ownerId?: string;
  segment?: string;
  productId?: string;
  status?: string;
};

export class DashboardFilterError extends Error {
  readonly statusCode = 400;

  constructor(message = "Dashboard filters are invalid.") {
    super(message);
    this.name = "DashboardFilterError";
  }
}

const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const identifier = z.string().trim().min(1).max(191).optional();
const filterSchema = z.object({
  from: dateValue,
  to: dateValue,
  departmentId: identifier,
  teamId: identifier,
  ownerId: identifier,
  segment: z.string().trim().min(1).max(100).optional(),
  productId: identifier,
  status: z.string().trim().min(1).max(64).optional(),
});

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseDashboardFilters(
  input: Record<string, string | string[] | undefined> | URLSearchParams,
): DashboardFilters {
  const values = Object.fromEntries(
    DASHBOARD_FILTER_KEYS.map((key) => [
      key,
      input instanceof URLSearchParams ? input.get(key) || undefined : first(input[key]),
    ]),
  );
  const parsed = filterSchema.safeParse(values);
  if (!parsed.success) throw new DashboardFilterError();
  if (parsed.data.from && parsed.data.to && parsed.data.from > parsed.data.to) {
    throw new DashboardFilterError("Dashboard date range is invalid.");
  }
  return parsed.data;
}

export function dashboardDateRange(filters: DashboardFilters) {
  return {
    from: filters.from ? new Date(`${filters.from}T00:00:00+07:00`) : undefined,
    to: filters.to ? new Date(`${filters.to}T23:59:59.999+07:00`) : undefined,
  };
}

export function dashboardFilterSearchParams(filters: DashboardFilters) {
  const params = new URLSearchParams();
  for (const key of DASHBOARD_FILTER_KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  return params;
}

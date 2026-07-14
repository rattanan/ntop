import { createHash } from "node:crypto";

import { FiscalPeriodType, Prisma, RevenueType, SalesTargetStatus, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import type { AuditWriter } from "../audit/audit-writer";
import type { AuthorizationContext } from "../authorization/authorization-context";
import { PERMISSIONS } from "../authorization/permission-policy";
import { money } from "../commercial/decimal-money";
import { canManageSalesTargetScope, requireForecastPermission } from "./forecast-authorization";

const nullableId = z.string().trim().min(1).max(191).nullable().default(null);
const nullableLabel = z.string().trim().min(1).max(191).nullable().default(null);
const moneyValue = z.string().regex(/^\d+(\.\d{1,4})?$/);

export const salesTargetInputSchema = z.strictObject({
  targetType: z.string().trim().min(1).max(64),
  userId: nullableId,
  teamId: nullableId,
  departmentId: nullableId,
  businessUnitId: nullableId,
  territoryId: nullableId,
  region: z.string().trim().min(1).max(100).nullable().default(null),
  productCategoryId: nullableLabel,
  customerSegment: z.string().trim().min(1).max(100).nullable().default(null),
  revenueType: z.nativeEnum(RevenueType),
  periodType: z.nativeEnum(FiscalPeriodType),
  fiscalYear: z.number().int().min(2000).max(2200),
  fiscalQuarter: z.number().int().min(1).max(4).nullable().default(null),
  fiscalMonth: z.number().int().min(1).max(12).nullable().default(null),
  targetAmount: moneyValue,
  targetGrossProfit: moneyValue.nullable().default(null),
  targetRecurringRevenue: moneyValue.nullable().default(null),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: z.nativeEnum(SalesTargetStatus).default(SalesTargetStatus.DRAFT),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable().default(null),
}).superRefine((input, context) => {
  if (input.effectiveTo && input.effectiveTo <= input.effectiveFrom) context.addIssue({ code: "custom", path: ["effectiveTo"], message: "Must be after effectiveFrom" });
  if (input.periodType === FiscalPeriodType.MONTH && input.fiscalMonth === null) context.addIssue({ code: "custom", path: ["fiscalMonth"], message: "Required for monthly target" });
  if (input.periodType === FiscalPeriodType.QUARTER && input.fiscalQuarter === null) context.addIssue({ code: "custom", path: ["fiscalQuarter"], message: "Required for quarterly target" });
});

export class SalesTargetOverlapError extends Error {
  constructor() { super("An overlapping sales target already exists for this scope and period."); this.name = "SalesTargetOverlapError"; }
}

export class SalesTargetValidationError extends Error {
  constructor(readonly issues?: unknown) { super("Sales target input is invalid."); this.name = "SalesTargetValidationError"; }
}

type Actor = { id: string; authorization: AuthorizationContext; permissions: ReadonlySet<string> };

function scopeKey(input: z.infer<typeof salesTargetInputSchema>) {
  const scope = {
    targetType: input.targetType,
    userId: input.userId,
    teamId: input.teamId,
    departmentId: input.departmentId,
    businessUnitId: input.businessUnitId,
    territoryId: input.territoryId,
    region: input.region,
    productCategoryId: input.productCategoryId,
    customerSegment: input.customerSegment,
    revenueType: input.revenueType,
    periodType: input.periodType,
    fiscalYear: input.fiscalYear,
    fiscalQuarter: input.fiscalQuarter,
    fiscalMonth: input.fiscalMonth,
    currency: input.currency,
  };
  return createHash("sha256").update(JSON.stringify(scope)).digest("hex");
}

export class SalesTargetService {
  constructor(private readonly client: PrismaClient, private readonly audit: AuditWriter<Prisma.TransactionClient>) {}

  async create(actor: Actor, rawInput: unknown, correlationId: string) {
    requireForecastPermission(actor.permissions, PERMISSIONS.forecastTargetManage);
    const parsed = salesTargetInputSchema.safeParse(rawInput);
    if (!parsed.success) throw new SalesTargetValidationError(parsed.error.flatten().fieldErrors);
    if (!canManageSalesTargetScope(actor.authorization, parsed.data)) throw new SalesTargetValidationError();
    const key = scopeKey(parsed.data);
    return this.client.$transaction(async (transaction) => {
      const overlap = await transaction.salesTarget.findFirst({
        where: {
          scopeKey: key,
          status: { not: SalesTargetStatus.INACTIVE },
          effectiveFrom: { lt: parsed.data.effectiveTo ?? new Date("9999-12-31T23:59:59.999Z") },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: parsed.data.effectiveFrom } }],
        },
        select: { id: true },
      });
      if (overlap) throw new SalesTargetOverlapError();
      const created = await transaction.salesTarget.create({
        data: {
          ...parsed.data,
          scopeKey: key,
          targetAmount: money(parsed.data.targetAmount),
          targetGrossProfit: parsed.data.targetGrossProfit === null ? null : money(parsed.data.targetGrossProfit),
          targetRecurringRevenue: parsed.data.targetRecurringRevenue === null ? null : money(parsed.data.targetRecurringRevenue),
          createdById: actor.id,
          updatedById: actor.id,
        },
      });
      await this.audit.append({
        actorId: actor.id,
        action: "forecast.target.create",
        targetType: "SalesTarget",
        targetId: created.id,
        targetVersion: String(created.version),
        outcome: "SUCCESS",
        correlationId,
        data: { scopeKey: key, periodType: created.periodType, fiscalYear: created.fiscalYear, revenueType: created.revenueType, status: created.status },
      }, { transaction });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

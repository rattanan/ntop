import { z } from "zod";

const money = z.string().trim().regex(/^-?\d{1,15}(\.\d{1,4})?$/);
const utcInstant = z.string().datetime({ offset: true });

export const contractItemSchema = z.strictObject({
  productId: z.string().trim().min(1).nullable().optional(),
  productCode: z.string().trim().min(1).max(191),
  serviceName: z.string().trim().min(1).max(255),
  description: z.string().max(10_000).nullable().optional(),
  quantity: money,
  unit: z.string().trim().min(1).max(50),
  monthlyCharge: money,
  oneTimeCharge: money,
  discountAmount: money,
  durationMonths: z.number().int().min(1).max(1200),
  installationRequired: z.boolean().default(false),
  solutionInstallationSiteId: z.string().trim().min(1).nullable().optional(),
  serviceLocation: z.string().trim().max(500).nullable().optional(),
  bandwidth: z.string().trim().max(100).nullable().optional(),
  sla: z.string().trim().max(255).nullable().optional(),
  supportLevel: z.string().trim().max(255).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000),
});

export const contractCreateSchema = z.strictObject({
  quoteVersionId: z.string().trim().min(1),
  contractTypeCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,59}$/),
  name: z.string().trim().min(1).max(255),
  customerContactId: z.string().trim().min(1).nullable().optional(),
  startDate: utcInstant.nullable().optional(),
  endDate: utcInstant.nullable().optional(),
  paymentTerm: z.string().trim().max(255).nullable().optional(),
  billingCycle: z.string().trim().max(100).nullable().optional(),
  taxRate: money.default("0"),
  terms: z.string().max(200_000).nullable().optional(),
  remarks: z.string().max(10_000).nullable().optional(),
  items: z.array(contractItemSchema).min(1).max(1000),
});

export const contractEditSchema = contractCreateSchema.omit({ quoteVersionId: true, contractTypeCode: true }).extend({
  expectedVersion: z.number().int().positive(),
  changeReason: z.string().trim().min(1).max(1000),
});

export const contractTransitionSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  toStatusCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,39}$/),
  comment: z.string().trim().min(1).max(1000),
});

export const contractSignatureSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  partyCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,39}$/),
  documentVersionId: z.string().trim().min(1),
  signedByName: z.string().trim().min(1).max(255),
  signedAt: utcInstant,
});

export const contractAmendmentSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  amendmentTypeCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,59}$/),
  reason: z.string().trim().min(1).max(1000),
  draft: contractEditSchema.omit({ expectedVersion: true, changeReason: true }),
});

export const contractRenewalSchema = z.strictObject({
  renewalTypeCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,59}$/),
  renewalDate: utcInstant,
  reminderDays: z.array(z.number().int().min(1).max(730)).min(1).max(12).default([90, 60, 30, 7]),
});

export type ContractCreateInput = z.infer<typeof contractCreateSchema>;
export type ContractEditInput = z.infer<typeof contractEditSchema>;
export type ContractItemInput = z.infer<typeof contractItemSchema>;

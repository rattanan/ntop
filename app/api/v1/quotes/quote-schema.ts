import { z } from "zod";

export const quoteDraftSchema = z.strictObject({
  quoteId: z.string().trim().min(1).optional(),
  proposalId: z.string().trim().min(1).optional(),
  opportunityId: z.string().trim().min(1),
  currency: z.string().trim().length(3).default("THB"),
  validUntil: z.string().datetime().nullable().optional(),
  notes: z.string().max(10000).optional(),
  items: z
    .array(
      z.strictObject({
        productId: z.string().trim().min(1),
        quantity: z.string().regex(/^\d+(\.\d{1,4})?$/),
        unitPrice: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
        discountAmount: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
        discountPct: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
      }),
    )
    .min(1)
    .max(100),
});

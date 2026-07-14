import { Prisma } from "@prisma/client";

import { decimal, money, ZERO, type DecimalInput } from "./decimal-money";

export type QuoteCalculationItem = {
  productId: string;
  productCode: string;
  productName: string;
  quantity: DecimalInput;
  unitPrice: DecimalInput;
  discountAmount?: DecimalInput;
  unitCost: DecimalInput;
};

export class QuoteCalculationError extends Error {
  constructor() {
    super("Quote calculation input is invalid.");
    this.name = "QuoteCalculationError";
  }
}

export function calculateQuote(items: readonly QuoteCalculationItem[]) {
  if (!items.length) throw new QuoteCalculationError();
  const lines = items.map((item) => {
    const quantity = decimal(item.quantity);
    const unitPrice = money(item.unitPrice);
    const unitCost = money(item.unitCost);
    const discountAmount = money(item.discountAmount ?? ZERO);
    if (
      quantity.lte(0) || unitPrice.lt(0) || unitCost.lt(0) ||
      discountAmount.lt(0)
    ) {
      throw new QuoteCalculationError();
    }
    const lineSubtotal = money(quantity.mul(unitPrice));
    if (discountAmount.gt(lineSubtotal)) throw new QuoteCalculationError();
    const lineTotal = money(lineSubtotal.minus(discountAmount));
    const lineCost = money(quantity.mul(unitCost));
    return {
      ...item,
      quantity,
      unitPrice,
      unitCost,
      discountAmount,
      lineSubtotal,
      lineTotal,
      lineCost,
      marginAmount: money(lineTotal.minus(lineCost)),
    };
  });
  const subtotal = money(lines.reduce((sum, item) => sum.plus(item.lineSubtotal), ZERO));
  const discountAmount = money(lines.reduce((sum, item) => sum.plus(item.discountAmount), ZERO));
  const total = money(lines.reduce((sum, item) => sum.plus(item.lineTotal), ZERO));
  const totalCost = money(lines.reduce((sum, item) => sum.plus(item.lineCost), ZERO));
  const grossMarginAmount = money(total.minus(totalCost));
  const grossMarginPct = total.isZero()
    ? ZERO
    : grossMarginAmount.div(total).mul(100).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
  return {
    lines,
    subtotal,
    discountAmount,
    total,
    totalCost,
    grossMarginAmount,
    grossMarginPct,
  };
}

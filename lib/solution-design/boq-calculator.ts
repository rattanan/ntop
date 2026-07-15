import { Prisma } from "@prisma/client";

const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const HUNDRED = D(100);
export type BoqCalculationInput = { quantity: Prisma.Decimal.Value; wastagePercent?: Prisma.Decimal.Value; unitCost?: Prisma.Decimal.Value; unitSellingPrice?: Prisma.Decimal.Value; discountPercent?: Prisma.Decimal.Value };
export function calculateBoqLine(input: BoqCalculationInput) {
  const quantity = D(input.quantity);
  const wastagePercent = D(input.wastagePercent ?? 0);
  const finalQuantity = quantity.mul(D(1).add(wastagePercent.div(HUNDRED)));
  const unitCost = D(input.unitCost ?? 0);
  const unitSellingPrice = D(input.unitSellingPrice ?? 0);
  const discount = D(input.discountPercent ?? 0);
  const totalCost = finalQuantity.mul(unitCost);
  const totalSellingPrice = finalQuantity.mul(unitSellingPrice).mul(D(1).sub(discount.div(HUNDRED)));
  const grossProfit = totalSellingPrice.sub(totalCost);
  const grossMarginPercent = totalSellingPrice.isZero() ? D(0) : grossProfit.div(totalSellingPrice).mul(HUNDRED);
  return { finalQuantity, totalCost, totalSellingPrice, grossProfit, grossMarginPercent };
}

export type BoqTotalsLine = ReturnType<typeof calculateBoqLine> & { chargeType: string; contractMonths?: number | null };
export function calculateBoqTotals(lines: readonly BoqTotalsLine[]) {
  let totalOneTimeCost=D(0),totalOneTimePrice=D(0),monthlyRecurringCost=D(0),monthlyRecurringPrice=D(0),annualRecurringCost=D(0),annualRecurringPrice=D(0);
  for (const line of lines) {
    if (line.chargeType === "MONTHLY_RECURRING") { monthlyRecurringCost=monthlyRecurringCost.add(line.totalCost); monthlyRecurringPrice=monthlyRecurringPrice.add(line.totalSellingPrice); }
    else if (line.chargeType === "ANNUAL_RECURRING") { annualRecurringCost=annualRecurringCost.add(line.totalCost); annualRecurringPrice=annualRecurringPrice.add(line.totalSellingPrice); }
    else { totalOneTimeCost=totalOneTimeCost.add(line.totalCost); totalOneTimePrice=totalOneTimePrice.add(line.totalSellingPrice); }
  }
  const maxContractMonths = Math.max(0, ...lines.map((line) => line.contractMonths ?? 0));
  const totalContractValue = totalOneTimePrice.add(monthlyRecurringPrice.mul(maxContractMonths)).add(annualRecurringPrice.mul(D(maxContractMonths).div(12)));
  const totalCost = totalOneTimeCost.add(monthlyRecurringCost.mul(maxContractMonths)).add(annualRecurringCost.mul(D(maxContractMonths).div(12)));
  const grossProfit = totalContractValue.sub(totalCost);
  const grossMarginPercent = totalContractValue.isZero() ? D(0) : grossProfit.div(totalContractValue).mul(HUNDRED);
  return { totalOneTimeCost,totalOneTimePrice,monthlyRecurringCost,monthlyRecurringPrice,annualRecurringCost,annualRecurringPrice,totalContractValue,totalCost,grossProfit,grossMarginPercent };
}

import { Prisma } from "@prisma/client";
import type { ContractItemInput } from "./contracts";

const Decimal = Prisma.Decimal;
const scale = (value: Prisma.Decimal.Value) => new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

export type ContractFinancials = {
  items: Array<ContractItemInput & { lineContractValue: string }>;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalWithTax: string;
  totalContractValue: string;
  monthlyRecurringRevenue: string;
  oneTimeRevenue: string;
  annualRecurringRevenue: string;
};

export function calculateContractFinancials(items: ContractItemInput[], taxRate: string): ContractFinancials {
  const normalized = items.map((item) => {
    const quantity = new Decimal(item.quantity);
    const recurring = new Decimal(item.monthlyCharge).mul(quantity).mul(item.durationMonths);
    const oneTime = new Decimal(item.oneTimeCharge).mul(quantity);
    const line = recurring.plus(oneTime).minus(item.discountAmount);
    if (quantity.lte(0) || new Decimal(item.monthlyCharge).lt(0) || new Decimal(item.oneTimeCharge).lt(0) || new Decimal(item.discountAmount).lt(0) || line.lt(0)) {
      throw new ContractFinancialError("Contract amounts must be non-negative and discount cannot exceed line value.");
    }
    return { ...item, lineContractValue: scale(line).toFixed(4) };
  });
  const subtotal = normalized.reduce((sum, item) => sum.plus(new Decimal(item.monthlyCharge).mul(item.quantity).mul(item.durationMonths)).plus(new Decimal(item.oneTimeCharge).mul(item.quantity)), new Decimal(0));
  const discount = normalized.reduce((sum, item) => sum.plus(item.discountAmount), new Decimal(0));
  const total = subtotal.minus(discount);
  const rate = new Decimal(taxRate);
  if (rate.lt(0) || rate.gt(100)) throw new ContractFinancialError("Tax rate must be between 0 and 100.");
  const tax = total.mul(rate).div(100);
  const mrr = normalized.reduce((sum, item) => sum.plus(new Decimal(item.monthlyCharge).mul(item.quantity)), new Decimal(0));
  const otr = normalized.reduce((sum, item) => sum.plus(new Decimal(item.oneTimeCharge).mul(item.quantity)), new Decimal(0));
  return {
    items: normalized,
    subtotal: scale(subtotal).toFixed(4),
    discountAmount: scale(discount).toFixed(4),
    taxAmount: scale(tax).toFixed(4),
    totalWithTax: scale(total.plus(tax)).toFixed(4),
    totalContractValue: scale(total).toFixed(4),
    monthlyRecurringRevenue: scale(mrr).toFixed(4),
    oneTimeRevenue: scale(otr).toFixed(4),
    annualRecurringRevenue: scale(mrr.mul(12)).toFixed(4),
  };
}

export class ContractFinancialError extends Error {
  constructor(message: string) { super(message); this.name = "ContractFinancialError"; }
}

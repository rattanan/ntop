import { describe, expect, it } from "vitest";

import { calculateQuote, QuoteCalculationError } from "../../lib/commercial/quote-calculator";

describe("calculateQuote", () => {
  it("reproduces totals, cost and margin using Decimal only", () => {
    const result = calculateQuote([
      { productId: "p1", productCode: "P1", productName: "Service", quantity: "3.0000", unitPrice: "1000000.1250", discountAmount: "100000.0000", unitCost: "600000.0000" },
    ]);
    expect(result.subtotal.toFixed(4)).toBe("3000000.3750");
    expect(result.total.toFixed(4)).toBe("2900000.3750");
    expect(result.totalCost.toFixed(4)).toBe("1800000.0000");
    expect(result.grossMarginAmount.toFixed(4)).toBe("1100000.3750");
  });

  it("rejects a discount greater than the line subtotal", () => {
    expect(() => calculateQuote([{ productId: "p", productCode: "P", productName: "P", quantity: "1", unitPrice: "10", discountAmount: "11", unitCost: "0" }])).toThrow(QuoteCalculationError);
  });
});

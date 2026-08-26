import { describe, expect, it } from "vitest";

import { formatCount, formatDecimal, formatMoney } from "../../lib/number-format";

describe("number display formatting", () => {
  it("groups money and always displays two decimal places", () => {
    expect(formatMoney("4200000", "THB")).toBe("4,200,000.00 THB");
    expect(formatMoney("999.999", "THB")).toBe("1,000.00 THB");
  });

  it("formats counts without floating point conversion", () => {
    expect(formatCount("123456789012345678")).toBe("123,456,789,012,345,678");
    expect(formatDecimal("-1200.5", 2)).toBe("-1,200.50");
  });
});

import { describe, expect, it } from "vitest";

import { prospectCommandSchema } from "../../lib/prospect/prospect-validation";

describe("prospectCommandSchema", () => {
  it("accepts the blank contact object submitted by the new prospect form", () => {
    const result = prospectCommandSchema.safeParse({
      companyName: "Enterprise Test",
      source: "MANUAL",
      status: "NEW",
      contact: { name: "", email: "", phone: "", mobile: "", lineId: "", isPrimary: true },
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.contact).toBeUndefined();
  });

  it("still validates a contact after the user starts entering contact details", () => {
    const result = prospectCommandSchema.safeParse({
      companyName: "Enterprise Test",
      source: "MANUAL",
      status: "NEW",
      contact: { name: "Test Contact", email: "", isPrimary: true },
    });

    expect(result.success).toBe(false);
  });

  it("accepts blank optional date fields from the browser form", () => {
    const result = prospectCommandSchema.safeParse({
      companyName: "Enterprise Test",
      source: "MANUAL",
      status: "NEW",
      numberOfEmployees: undefined,
      currentContractEndDate: "",
      nextFollowUpAt: "",
      contact: { name: "Test Contact", email: "contact@example.test", isPrimary: true },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currentContractEndDate).toBeUndefined();
      expect(result.data.nextFollowUpAt).toBeUndefined();
    }
  });
});

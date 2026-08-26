import { describe, expect, it } from "vitest";

import { normalizeSubIndustryCode, omitBlankLegacySubIndustry, type CustomerClassificationOption } from "../../lib/customer/customer-classification-options";
import { prospectCommandSchema } from "../../lib/prospect/prospect-validation";

const classifications: CustomerClassificationOption[] = [{
  code: "B1",
  name: "องค์กรธุรกิจขนาดใหญ่",
  subIndustries: [{ code: "B1-LONG", name: "อุตสาหกรรมเดิมที่มีชื่อยาวเกินห้าสิบตัวอักษรและต้องแปลงเป็นรหัสอ้างอิง" }],
}];

describe("prospectCommandSchema", () => {
  it("accepts a non-13-digit juristic identifier and still bounds its length", () => {
    const base = { companyName: "Enterprise Test", source: "MANUAL", status: "NEW" } as const;
    expect(prospectCommandSchema.safeParse({ ...base, taxId: "REG-7" }).success).toBe(true);
    expect(prospectCommandSchema.safeParse({ ...base, taxId: "x".repeat(33) }).success).toBe(false);
  });

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

  it("normalizes legacy sub-industry labels before the edit form validates them", () => {
    const unknownLegacyValue = "legacy-sub-industry-".repeat(4);
    expect(normalizeSubIndustryCode("B1", "B1-LONG", classifications)).toBe("B1-LONG");
    expect(normalizeSubIndustryCode("B1", classifications[0].subIndustries[0].name, classifications)).toBe("B1-LONG");
    expect(normalizeSubIndustryCode("B1", unknownLegacyValue, classifications)).toBeUndefined();
    const submitValues = omitBlankLegacySubIndustry({
      companyName: "Enterprise Test",
      source: "MANUAL",
      status: "QUALIFIED" as const,
      organizationType: "B1",
      subIndustry: normalizeSubIndustryCode("B1", unknownLegacyValue, classifications),
    }, true);
    expect(submitValues).not.toHaveProperty("subIndustry");
    expect(prospectCommandSchema.safeParse(submitValues).success).toBe(true);
    expect(omitBlankLegacySubIndustry({ subIndustry: "B1-LONG" }, true)).toEqual({ subIndustry: "B1-LONG" });
  });

  it("reports an understandable sub-industry length error", () => {
    const result = prospectCommandSchema.safeParse({
      companyName: "Enterprise Test",
      source: "MANUAL",
      status: "QUALIFIED",
      subIndustry: "x".repeat(51),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.subIndustry).toEqual(["อุตสาหกรรมย่อยต้องไม่เกิน 50 ตัวอักษร"]);
    }
  });
});

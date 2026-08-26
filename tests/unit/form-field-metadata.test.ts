import { describe, expect, it } from "vitest";

import { getFormFieldMetadata, getNumericFieldUnit } from "../../lib/form-field-metadata";

describe("form field metadata", () => {
  it("provides Thai meaning, example and unit for known numeric fields", () => {
    const result = getFormFieldMetadata("estimatedOpportunityValue", "Estimated Value");
    expect(result.description).toContain("มูลค่า");
    expect(result.example).toBe("4200000");
    expect(getNumericFieldUnit("estimatedOpportunityValue")).toBe("บาท");
    expect(getNumericFieldUnit("numberOfEmployees")).toBe("คน");
  });

  it("supports nested and indexed field names and supplies a Thai fallback", () => {
    expect(getNumericFieldUnit("items[0].quantity")).toBe("หน่วย");
    expect(getFormFieldMetadata("unmappedField", "ข้อมูลอ้างอิง").description).toContain("ข้อมูลอ้างอิง");
  });
});

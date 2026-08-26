import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { THAI_DISTRICTS } from "../../lib/customer/district-reference-data";

const read = (path: string) => readFileSync(path, "utf8");

describe("Installation Site province-dependent district reference", () => {
  it("ships the complete active DOPA district dataset with valid unique codes", () => {
    const provinceCodes = new Set(THAI_DISTRICTS.map((district) => district.provinceCode));

    expect(THAI_DISTRICTS).toHaveLength(928);
    expect(new Set(THAI_DISTRICTS.map((district) => district.code)).size).toBe(928);
    expect(provinceCodes.size).toBe(77);
    expect(THAI_DISTRICTS.every((district) => /^\d{4}$/.test(district.code))).toBe(true);
    expect(THAI_DISTRICTS.every((district) => district.code.startsWith(district.provinceCode))).toBe(true);
    expect(THAI_DISTRICTS.filter((district) => district.provinceCode === "10")).toHaveLength(50);
  });

  it("loads District only after Province and keeps the API query bounded", () => {
    const form = read("components/presales-forms.tsx");
    const reference = read("lib/customer/district-reference.ts");
    const route = read("app/api/v1/reference/districts/route.ts");

    expect(form.indexOf("Province / จังหวัด")).toBeLessThan(form.indexOf("District / อำเภอ/เขต"));
    expect(form).toContain("/api/v1/reference/districts?");
    expect(form).toContain("disabled={!province||districtLoading||Boolean(districtError)}");
    expect(reference).toContain("take: 100");
    expect(reference).toContain("where: { provinceCode, active: true, province: { active: true } }");
    expect(route).toContain("getSession");
    expect(route).toContain("provinceCode must contain 2 digits");
  });

  it("validates the selected Province/District pair inside the server transaction", () => {
    const service = read("lib/solution-design/solution-design-service.ts");

    expect(service).toContain("tx.districtReference.findFirst");
    expect(service).toContain('province:{is:{name:parsed.data.province,active:true}}');
    expect(service).toContain('new PresalesValidationError(["province","district"])');
  });
});

import { describe, expect, it } from "vitest";
import { buildProspectSearchWhere } from "../../lib/prospect/prospect-search";

describe("Prospect search", () => {
  it("normalizes punctuation in company abbreviations", () => {
    const where = buildProspectSearchWhere("ธ.ก.ศ");

    expect(where.OR).toContainEqual({
      normalizedCompanyName: { contains: "ธกศ" },
    });
    expect(where.OR).toContainEqual({
      normalizedCompanyEnglish: { contains: "ธกศ" },
    });
  });

  it("searches structured category and industry fields", () => {
    const where = buildProspectSearchWhere("ธนาคาร");

    expect(where.OR).toContainEqual({ customerType: { contains: "ธนาคาร" } });
    expect(where.OR).toContainEqual({
      organizationType: { contains: "ธนาคาร" },
    });
    expect(where.OR).toContainEqual({ subIndustry: { contains: "ธนาคาร" } });
    expect(where.OR).toContainEqual({
      industry: { is: { name: { contains: "ธนาคาร" } } },
    });
    expect(where.OR).toContainEqual({
      normalizedCompanyName: { contains: "ธกศ" },
    });
    expect(where.OR).toContainEqual({
      normalizedCompanyEnglish: { contains: "scb" },
    });
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const form = readFileSync("components/prospect-form.tsx", "utf8");

describe("Prospect create company field UI contract", () => {
  it("keeps company name as a normal field and removes AI Search from the form", () => {
    expect(form).toContain('field("companyName", "ชื่อบริษัท/หน่วยงาน", "text", true)');
    expect(form).not.toContain("prospect-search-control");
    expect(form).not.toContain('fetch("/api/v1/prospects/research"');
    expect(form).not.toContain("AI Search");
    expect(form).toContain('type="submit"');
  });
});

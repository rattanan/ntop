import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const form = readFileSync("components/prospect-form.tsx", "utf8");
const page = readFileSync("app/(portal)/prospects/new/page.tsx", "utf8");

describe("Prospect create AI Search UI contract", () => {
  it("keeps Search inline, visible only for create, and requires explicit save", () => {
    expect(form).toContain("prospect-search-control");
    expect(form).toContain('type="button"');
    expect(form).toContain("!prospect &&");
    expect(form).toContain('fetch("/api/v1/prospects/research"');
    expect(form).toContain('type="submit"');
  });

  it("preserves entered values and shows Internet sources", () => {
    expect(form).toContain("!isEmpty(getValues(name))");
    expect(form).toContain("researchResult.sources.map");
    expect(form).toContain('rel="noreferrer"');
    expect(form).toContain('register("sourceReference")');
  });

  it("temporarily disables Search by default behind a server-side feature flag", () => {
    expect(page).toContain('process.env.PROSPECT_AI_SEARCH_ENABLED === "true"');
    expect(page).toContain("companyResearchEnabled={companyResearchEnabled}");
    expect(form).toContain("companyResearchEnabled = false");
    expect(form).toContain("!companyResearchEnabled || isResearching || isSubmitting");
    expect(form).toContain("AI Search ปิดใช้งานชั่วคราว");
  });
});

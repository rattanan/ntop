import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const list = readFileSync("app/(portal)/opportunities/page.tsx", "utf8");
const detail = readFileSync("app/(portal)/opportunities/[id]/page.tsx", "utf8");
const forms = readFileSync("components/workflow-forms.tsx", "utf8");
const api = readFileSync("app/api/v1/opportunities/[id]/probability/route.ts", "utf8");

describe("Opportunity Phase 1 UI and API contracts", () => {
  it("uses authorization-scoped query services on list and detail", () => {
    expect(list).toContain("loadAuthorizationContext");
    expect(list).toContain("listOpportunities(context");
    expect(detail).toContain("getOpportunity(context,id)");
    expect(detail).not.toContain("findUnique({");
  });

  it("shows identity, health, forecast and probability evidence", () => {
    expect(detail).toContain("opportunity.opportunityNumber");
    expect(detail).toContain("Opportunity Health");
    expect(detail).toContain("probabilityHistory");
    expect(detail).toContain("OpportunityProbabilityDialog");
  });

  it("edits probability from the summary pencil button in a dialog without a lower-page form", () => {
    expect(forms).toContain('aria-label="แก้ไข Probability"');
    expect(forms).toContain("dialog.current?.showModal()");
    expect(forms).toContain("Forecast probability override");
    expect(detail).not.toContain("OpportunityProbabilityForm");
    expect(detail).not.toContain('className="card" id="commercial"');
  });

  it("enforces probability override through the authenticated server runtime", () => {
    expect(api).toContain("getSession()");
    expect(api).toContain("loadAuthorizationContext");
    expect(api).toContain("overrideProbability");
    expect(api).toContain("requireIdempotencyKey");
  });
});

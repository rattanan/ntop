import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("app/api/v1/prospects/route.ts", "utf8");
const detail = readFileSync("app/api/v1/prospects/[id]/route.ts", "utf8");
const preview = readFileSync("app/api/v1/prospects/import/preview/route.ts", "utf8");
const enrich = readFileSync("lib/prospect/prospect-enrichment-service.ts", "utf8");
const enrichRoute = readFileSync("app/api/v1/prospects/[id]/enrich/route.ts", "utf8");
const apiErrors = readFileSync("app/api/v1/prospects/prospect-api.ts", "utf8");

describe("Prospect API contract", () => {
  it("uses session, permission codes, scoped queries and idempotency", () => {
    expect(route).toContain("prospectActor");
    expect(route).toContain("buildProspectScopeWhere");
    expect(route).toContain("prospectIdempotencyKey");
    expect(detail).toContain("buildProspectScopeWhere");
  });

  it("bounds, validates, and checks duplicates during import preview", () => {
    expect(preview).toContain("prospectImport");
    expect(preview).toContain("5_000_000");
    expect(preview).toMatch(/rows\.length\s*>\s*1000/);
    expect(preview).toContain("buildProspectScopeWhere");
    expect(preview).toContain('status:"DUPLICATE"');
  });

  it("maps schema validation errors to the API validation response", () => {
    expect(apiErrors).toContain("error instanceof ZodError");
    expect(apiErrors).toContain('code = "VALIDATION_FAILED"');
  });

  it("keeps AI output draft until human confirmation and records provider failures", () => {
    expect(enrich).toContain('enrichmentStatus: "READY"');
    expect(enrich).toContain('enrichmentStatus: "CONFIRMED"');
    expect(enrich).toContain('enrichmentStatus: "FAILED"');
    expect(enrich).toContain('outcome: "FAILURE"');
    expect(enrichRoute).toContain("requiresConfirmation:true");
  });
});

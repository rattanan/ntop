import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("InsightKM service integration contract", () => {
  it("uses a constant-time bearer key and an active least-privilege actor", () => {
    const auth = read("lib/auth.ts");
    expect(auth).toContain("timingSafeEqual");
    expect(auth).toContain("NTOP_INTEGRATION_API_KEY");
    expect(auth).toContain("NTOP_INTEGRATION_ACTOR_ID");
    expect(auth).toContain("user?.active");
  });

  it("exposes scoped quotation search and detail reads", () => {
    const collection = read("app/api/v1/quotes/route.ts");
    const detail = read("app/api/v1/quotes/[id]/route.ts");
    for (const source of [collection, detail]) {
      expect(source).toContain("buildOpportunityScopeWhere");
      expect(source).toContain("export async function GET");
    }
    expect(collection).toContain("createQuoteRuntime().createVersion");
  });

  it("documents both server-side integration settings", () => {
    const example = read(".env.example");
    expect(example).toContain("NTOP_INTEGRATION_API_KEY");
    expect(example).toContain("NTOP_INTEGRATION_ACTOR_ID");
  });
});

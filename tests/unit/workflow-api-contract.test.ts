import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Workflow REST v1 contract", () => {
  it("routes transition through service with version and idempotency", () => {
    const route = read("app/api/v1/opportunities/[id]/transitions/route.ts");
    expect(route).toContain("createOpportunityRuntime().transition");
    expect(route).toContain("expectedVersion");
    expect(route).toContain("requireIdempotencyKey");
    expect(route).not.toContain("prisma.opportunity.update");
  });

  it("exposes scoped Opportunity CRUD through the same application service", () => {
    const collection = read("app/api/v1/opportunities/route.ts");
    const item = read("app/api/v1/opportunities/[id]/route.ts");
    expect(collection).toContain("listOpportunities");
    expect(collection).toContain("createOpportunityRuntime().create");
    expect(item).toContain("getOpportunity");
    expect(item).toContain("createOpportunityRuntime().update");
    expect(item).toContain('headers.get("if-match")');
    for (const route of [collection, item]) expect(route).toContain("loadAuthorizationContext");
  });

  it("exposes forecast summary, quality, list and immutable snapshot retrieval", () => {
    const list = read("app/api/v1/forecasts/snapshots/route.ts");
    const item = read("app/api/v1/forecasts/snapshots/[id]/route.ts");
    const summary = read("app/api/v1/forecasts/summary/route.ts");
    const quality = read("app/api/v1/forecasts/quality/route.ts");
    expect(list).toContain("listForecastSnapshots");
    expect(item).toContain("getForecastSnapshot");
    expect(summary).toContain("result.summary");
    expect(quality).toContain("result.quality");
  });

  it("routes quote versions, submit and approval decisions through services", () => {
    const create = read("app/api/v1/quotes/route.ts");
    const submit = read("app/api/v1/quotes/[id]/submit/route.ts");
    const decision = read("app/api/v1/approval-requests/[id]/decisions/route.ts");
    expect(create).toContain("createQuoteRuntime().createVersion");
    expect(submit).toContain("createQuoteRuntime().submit");
    expect(decision).toContain("createApprovalRuntime().decide");
    for (const route of [create, submit, decision]) expect(route).toContain("requireIdempotencyKey");
  });

  it("keeps pipeline bounded and scope-derived", () => {
    const route = read("app/api/v1/pipeline/route.ts");
    expect(route).toContain("loadAuthorizationContext");
    expect(route).toContain("slice(0, 200)");
    expect(route).toContain("commitAmount");
    expect(route).toContain("bestCaseAmount");
  });
});

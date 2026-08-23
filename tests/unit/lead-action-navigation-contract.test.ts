import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const action = readFileSync(join(process.cwd(), "app/actions/lead.ts"), "utf8");

describe("Lead workflow navigation contract", () => {
  it("opens the created Activity after recording it from a Lead", () => {
    expect(action).toContain("select: { id: true }");
    expect(action).toContain("`/activities/${result.activityId}`");
  });

  it("opens the Customer sales context after Lead conversion", () => {
    expect(action).toContain("`/customers/${converted.customerId}?tab=sales`");
    expect(action).not.toContain("redirect(`/opportunities/${converted.opportunityId}`)");
  });
});

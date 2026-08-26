import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const action = readFileSync(join(process.cwd(), "app/actions/lead.ts"), "utf8");

describe("Lead workflow navigation contract", () => {
  it("keeps Activity creation in the Lead dialog and refreshes the timeline", () => {
    expect(action).toContain("select: { id: true }");
    expect(action).toContain('status: "success", message: result.activityId');
    expect(action).not.toContain("`/activities/${result.activityId}`");
  });

  it("reports success and sends the client to the created Opportunity", () => {
    expect(action).toContain('redirectTo: `/opportunities/${converted.opportunityId}`');
    expect(action).not.toContain("`/customers/${converted.customerId}?tab=sales`");
  });
});

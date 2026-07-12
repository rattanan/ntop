import { describe, expect, it } from "vitest";

import {
  ACTIVITY_TYPES,
  APPROACHES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  SEGMENTS,
  STAGES,
} from "../../lib/constants";

function keysOf(entries: readonly (readonly [string, string])[]) {
  return entries.map(([key]) => key);
}

describe("domain constants", () => {
  it.each([
    ["segments", SEGMENTS],
    ["stages", keysOf(STAGES)],
    ["approaches", keysOf(APPROACHES)],
    ["lead sources", keysOf(LEAD_SOURCES)],
    ["lead statuses", keysOf(LEAD_STATUSES)],
    ["activity types", keysOf(ACTIVITY_TYPES)],
  ])("keeps %s identifiers unique", (_name, identifiers) => {
    expect(new Set(identifiers).size).toBe(identifiers.length);
  });

  it("keeps terminal opportunity stages available", () => {
    const stageKeys = keysOf(STAGES);

    expect(stageKeys).toContain("WON");
    expect(stageKeys).toContain("LOST");
  });
});

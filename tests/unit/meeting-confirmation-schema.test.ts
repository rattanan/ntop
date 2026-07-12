import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  join(
    process.cwd(),
    "prisma/migrations/20260711210000_add_meeting_draft_confirmation/migration.sql",
  ),
  "utf8",
);
const nextActionMigration = readFileSync(
  join(
    process.cwd(),
    "prisma/migrations/20260712090000_add_meeting_next_action_confirmation/migration.sql",
  ),
  "utf8",
);

describe("Meeting Draft confirmation persistence", () => {
  it("links exactly one output to one confirmed Activity", () => {
    expect(schema).toContain("model MeetingDraftConfirmation {");
    expect(schema).toContain("idempotencyKey String    @unique");
    expect(schema).toContain("aiOutputId     String    @unique");
    expect(schema).toContain("activityId     String    @unique");
    expect(schema).toContain("nextActionActivityId String?   @unique");
  });

  it("stores selected and final content with actor/time evidence", () => {
    for (const field of [
      "selectedFields",
      "finalContent",
      "confirmedById",
      "confirmedAt",
    ]) {
      expect(schema).toContain(field);
    }
  });

  it("is additive and does not alter legacy Activity columns", () => {
    expect(migration).not.toContain("ALTER TABLE `Activity`");
    expect(migration).not.toContain("DROP TABLE");
    expect(nextActionMigration).not.toContain("ALTER TABLE `Activity`");
    expect(nextActionMigration).not.toContain("DROP TABLE");
  });
});

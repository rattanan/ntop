import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/20260715220000_add_activity_management/migration.sql", "utf8");
const list = readFileSync("app/(portal)/activities/page.tsx", "utf8");
const detail = readFileSync("app/(portal)/activities/[id]/page.tsx", "utf8");
const edit = readFileSync("app/(portal)/activities/[id]/edit/page.tsx", "utf8");
const route = readFileSync("app/api/v1/activities/[id]/route.ts", "utf8");
const component = readFileSync("components/activity-management.tsx", "utf8");
const opportunity = readFileSync("lib/opportunity/opportunity-query-service.ts", "utf8");
const prospect = readFileSync("app/(portal)/prospects/[id]/page.tsx", "utf8");
const lead = readFileSync("app/(portal)/leads/[id]/page.tsx", "utf8");

describe("Activity management contract", () => {
  it("uses additive versioned soft delete schema", () => {
    expect(schema).toMatch(/model Activity[\s\S]*version\s+Int\s+@default\(1\)[\s\S]*deletedAt\s+DateTime\?/);
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(migration).toContain("Activity_owner_deleted_created_idx");
    expect(migration).not.toContain("CURRENT_TIMESTAMP(3)");
  });
  it("provides scoped detail, edit and delete routes", () => {
    expect(list).toContain("buildActivityScopeWhere"); expect(list).toContain("/edit`}"); expect(detail).toContain("ActivityDeleteButton"); expect(edit).toContain("ActivityEditForm");
    expect(route).toContain("export async function GET"); expect(route).toContain("export async function PATCH"); expect(route).toContain("export async function DELETE");
  });
  it("requires delete confirmation reason and exposes accessible controls", () => {
    expect(component).toContain('aria-labelledby="delete-activity-title"'); expect(component).toContain('name="reason"'); expect(component).toContain("minLength={5}"); expect(component).toContain('<Notice variant="error">');
  });
  it("hides soft-deleted activities from related record timelines", () => {
    expect(opportunity).toContain("activities: { where: { deletedAt: null }");
    expect(prospect).toContain("activities: { where: { deletedAt: null }");
    expect(lead).toContain("activities:{where:{deletedAt:null}");
  });
});

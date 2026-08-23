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
const permissionMigration = readFileSync("prisma/migrations/20260716224500_provision_activity_permissions/migration.sql", "utf8");
const historyMigration = readFileSync("prisma/migrations/20260716230000_add_activity_status_history/migration.sql", "utf8");

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
  it("shows linked Lead details in the activities list", () => {
    expect(list).toContain("lead: true");
    expect(list).toContain("Customer / Opportunity / Lead");
    expect(list).toContain("activity.lead?.company");
    expect(list).toContain("activity.lead.leadNumber");
  });
  it("requires delete confirmation reason and exposes accessible controls", () => {
    expect(component).toContain('aria-labelledby="delete-activity-title"'); expect(component).toContain('name="reason"'); expect(component).toContain("minLength={5}"); expect(component).toContain('<Notice variant="error">');
  });
  it("hides soft-deleted activities from related record timelines", () => {
    expect(opportunity).toContain("activities: { where: { deletedAt: null }");
    expect(prospect).toContain("activities: { where: { deletedAt: null }");
    expect(lead).toContain("activities:{where:{deletedAt:null}");
  });
  it("provisions workflow permissions without relying on demo seed", () => {
    expect(permissionMigration).toContain("'activity.assign'");
    expect(permissionMigration).toContain("'activity.complete'");
    expect(permissionMigration).toContain("'TEAM_MANAGER'");
    expect(permissionMigration).toContain("'KAM'");
    expect(permissionMigration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
  });
  it("explains why a non-owner cannot change status and how to continue", () => {
    expect(detail).toContain("const isOwner = activity.ownerId === session.id");
    expect(detail).toContain("ผู้รับผิดชอบจึงเป็นผู้เปลี่ยนสถานะ");
    expect(detail).toContain("ให้มอบหมาย Activity ให้ตัวเองก่อน");
    expect(detail).toContain("activity.complete");
  });
  it("persists and displays Activity status history", () => {
    expect(schema).toContain("model ActivityStatusHistory");
    expect(historyMigration).toContain("CREATE TABLE `ActivityStatusHistory`");
    expect(historyMigration).toContain("ActivityStatusHistory_activityId_transitionedAt_idx");
    expect(historyMigration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(detail).toContain("statusHistory:");
    expect(detail).toContain("ประวัติสถานะ");
    expect(detail).toContain("history.fromStatus.label");
    expect(detail).toContain("history.actor.name");
  });
});

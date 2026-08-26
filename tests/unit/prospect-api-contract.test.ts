import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("app/api/v1/prospects/route.ts", "utf8");
const detail = readFileSync("app/api/v1/prospects/[id]/route.ts", "utf8");
const assign = readFileSync("app/api/v1/prospects/[id]/assign/route.ts", "utf8");
const preview = readFileSync("app/api/v1/prospects/import/preview/route.ts", "utf8");
const enrich = readFileSync("lib/prospect/prospect-enrichment-service.ts", "utf8");
const enrichRoute = readFileSync("app/api/v1/prospects/[id]/enrich/route.ts", "utf8");
const apiErrors = readFileSync("app/api/v1/prospects/prospect-api.ts", "utf8");
const researchRoute = readFileSync("app/api/v1/prospects/research/route.ts", "utf8");
const contactsRoute = readFileSync("app/api/v1/prospects/[id]/contacts/route.ts", "utf8");
const contactRoute = readFileSync("app/api/v1/prospects/[id]/contacts/[contactId]/route.ts", "utf8");
const activityRoute = readFileSync("app/api/v1/prospects/[id]/activities/[activityId]/route.ts", "utf8");
const documentRoute = readFileSync("app/api/v1/prospects/[id]/documents/[documentId]/route.ts", "utf8");
const permissionMigration = readFileSync("prisma/migrations/20260822090000_backfill_prospect_management_permissions/migration.sql", "utf8");
const prospectDetail = readFileSync("app/(portal)/prospects/[id]/page.tsx", "utf8");
const prospectList = readFileSync("app/(portal)/prospects/page.tsx", "utf8");
const prospectActions = readFileSync("components/prospect-action-forms.tsx", "utf8");
const prospectRepository = readFileSync("lib/prospect/prospect-repository.ts", "utf8");
const enrichmentContext = readFileSync("lib/prospect/prospect-enrichment-context.ts", "utf8");

describe("Prospect API contract", () => {
  it("uses session, permission codes, scoped queries and idempotency", () => {
    expect(route).toContain("prospectActor");
    expect(route).toContain("buildProspectScopeWhere");
    expect(route).toContain("prospectIdempotencyKey");
    expect(detail).toContain("buildProspectScopeWhere");
  });

  it("redirects to the Prospect list after assignment removes the actor read scope", () => {
    expect(assign).toContain("createProspectRuntime().assign");
    expect(prospectActions).toContain("result.accessRetained === false");
    expect(prospectActions).toContain('router.replace("/prospects?notice=owner-assigned")');
    expect(prospectList).toContain('query.notice === "owner-assigned"');
    expect(prospectList).toContain("มอบหมาย Owner สำเร็จ");
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
    expect(prospectDetail).toContain("<ProspectAiInsightActions");
    expect(prospectActions).toContain("Request AI Insight");
    expect(prospectActions).toContain("/enrich/confirm");
    expect(prospectActions).toContain("Human review required");
    expect(prospectRepository).toContain("findEnrichmentContext");
    expect(prospectRepository).toContain("buildProspectScopeWhere(context, permissions)");
    expect(prospectRepository).toContain("take: 20");
    expect(prospectRepository).toContain("take: 50");
    expect(prospectRepository).toContain("take: 10");
    expect(enrichmentContext).toContain("contactChannelAvailability");
    expect(enrichmentContext).toContain("MAX_ENRICHMENT_CONTEXT_CHARACTERS");
  });

  it("protects company web research and audits it without creating a Prospect", () => {
    expect(researchRoute).toContain("PERMISSIONS.prospectCreate");
    expect(researchRoute).toContain("requireProspectPermission");
    expect(researchRoute).toContain('action: "prospect.company-research.search"');
    expect(researchRoute).toContain('outcome: "SUCCESS"');
    expect(researchRoute).toContain('outcome: "FAILURE"');
    expect(researchRoute).not.toMatch(/prospect\.(create|update|upsert)/);
  });

  it("exposes idempotent contact create, update, and delete commands", () => {
    expect(contactsRoute).toContain("prospectActor");
    expect(contactsRoute).toContain("prospectIdempotencyKey");
    expect(contactsRoute).toContain("expectedVersion");
    expect(contactRoute).toContain("export async function PATCH");
    expect(contactRoute).toContain("export async function DELETE");
    expect(contactRoute).toContain("prospectActor");
    expect(contactRoute).toContain("prospectIdempotencyKey");
  });

  it("shows authorized Prospect edit, Contact management, and document upload actions", () => {
    expect(prospectDetail).toContain("PERMISSIONS.prospectUpdate");
    expect(prospectDetail).toContain("/edit`}");
    expect(prospectDetail).toContain("<ProspectContactManager");
    expect(prospectDetail).toContain("<ProspectDocumentUpload");
    expect(prospectActions).toContain("เพิ่ม Contact");
    expect(prospectActions).toContain('"PATCH"');
    expect(prospectActions).toContain('"DELETE"');
  });

  it("keeps Activity creation inside the timeline panel behind an accessible toggle", () => {
    expect(prospectDetail).toContain("<ProspectActivityManager");
    expect(prospectDetail).toContain('className="prospect-timeline-list"');
    expect(prospectActions).toContain("export function ProspectActivityManager");
    expect(prospectActions).toContain('aria-expanded={creating}');
    expect(prospectActions).toContain('aria-controls="prospect-activity-form"');
    expect(prospectActions).toContain('id="prospect-activity-form"');
    expect(prospectActions).toContain("เพิ่ม Activity");
    expect(prospectActions).toContain("setCreating(false)");
    expect(prospectActions).not.toContain('<h3>เพิ่ม Activity</h3>');
  });

  it("exposes scoped Activity edit/delete and Document download/delete actions", () => {
    expect(activityRoute).toContain("export async function PATCH");
    expect(activityRoute).toContain("export async function DELETE");
    expect(activityRoute).toContain("prospectActor");
    expect(activityRoute).toContain("prospectIdempotencyKey");
    expect(documentRoute).toContain("export async function GET");
    expect(documentRoute).toContain("export async function DELETE");
    expect(documentRoute).toContain("private, no-store");
    expect(prospectActions).toContain("แก้ไข Activity");
    expect(prospectActions).toContain("ลบ Activity");
    expect(prospectActions).toContain("ดาวน์โหลดเอกสาร");
    expect(prospectActions).toContain("ลบเอกสาร");
    expect(prospectActions).not.toContain('className="icon-action danger"');
  });

  it("backfills Prospect mutation grants for existing role assignments", () => {
    expect(permissionMigration).toContain("INSERT IGNORE INTO `RolePermissionGrant`");
    expect(permissionMigration).toContain("'ADMIN', 'prospect.update'");
    expect(permissionMigration).toContain("'KAM', 'prospect.update'");
    expect(permissionMigration).toContain("'MARKETING', 'prospect.import'");
  });
});

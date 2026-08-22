import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("app/api/v1/prospects/route.ts", "utf8");
const detail = readFileSync("app/api/v1/prospects/[id]/route.ts", "utf8");
const preview = readFileSync("app/api/v1/prospects/import/preview/route.ts", "utf8");
const enrich = readFileSync("lib/prospect/prospect-enrichment-service.ts", "utf8");
const enrichRoute = readFileSync("app/api/v1/prospects/[id]/enrich/route.ts", "utf8");
const apiErrors = readFileSync("app/api/v1/prospects/prospect-api.ts", "utf8");
const researchRoute = readFileSync("app/api/v1/prospects/research/route.ts", "utf8");
const contactsRoute = readFileSync("app/api/v1/prospects/[id]/contacts/route.ts", "utf8");
const contactRoute = readFileSync("app/api/v1/prospects/[id]/contacts/[contactId]/route.ts", "utf8");
const permissionMigration = readFileSync("prisma/migrations/20260822090000_backfill_prospect_management_permissions/migration.sql", "utf8");
const prospectDetail = readFileSync("app/(portal)/prospects/[id]/page.tsx", "utf8");
const prospectActions = readFileSync("components/prospect-action-forms.tsx", "utf8");

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
    expect(prospectDetail).toContain("<ProspectAiInsightActions");
    expect(prospectActions).toContain("Request AI Insight");
    expect(prospectActions).toContain("/enrich/confirm");
    expect(prospectActions).toContain("Human review required");
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

  it("backfills Prospect mutation grants for existing role assignments", () => {
    expect(permissionMigration).toContain("INSERT IGNORE INTO `RolePermissionGrant`");
    expect(permissionMigration).toContain("'ADMIN', 'prospect.update'");
    expect(permissionMigration).toContain("'KAM', 'prospect.update'");
    expect(permissionMigration).toContain("'MARKETING', 'prospect.import'");
  });
});

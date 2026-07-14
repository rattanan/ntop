import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const schema=readFileSync(join(process.cwd(),"prisma/schema.prisma"),"utf8");
const forward=readFileSync(join(process.cwd(),"prisma/migrations/20260714120000_add_lead_workflow/migration.sql"),"utf8");
const legacy=readFileSync(join(process.cwd(),"prisma/legacy-mariadb-5.5-lead-workflow.sql"),"utf8");
const legacyIndex=readFileSync(join(process.cwd(),"prisma/legacy-mariadb-5.5-lead-receipt-index.sql"),"utf8");
const expansion=readFileSync(join(process.cwd(),"prisma/migrations/20260714170000_expand_lead_management/migration.sql"),"utf8");
const operations=readFileSync(join(process.cwd(),"prisma/migrations/20260714190000_add_lead_operations/migration.sql"),"utf8");
const listPage=readFileSync(join(process.cwd(),"app/(portal)/leads/page.tsx"),"utf8");
const detailPage=readFileSync(join(process.cwd(),"app/(portal)/leads/[id]/page.tsx"),"utf8");

describe("Lead workflow foundation",()=>{
  it("adds optimistic version and idempotency receipts",()=>{expect(schema).toContain("model LeadCommandReceipt");expect(schema).toMatch(/version\s+Int\s+@default\(1\)/);expect(schema).toContain("@@unique([actorId, idempotencyKey, command])");});
  it("provides additive MySQL 8 and MariaDB 5.5 migrations",()=>{for(const migration of[forward,legacy]){expect(migration).toContain("LeadCommandReceipt");expect(migration).toContain("ADD COLUMN `version`");expect(migration).not.toContain("DROP TABLE");}});
  it("uses hash-backed exact receipt uniqueness on legacy InnoDB",()=>{expect(legacyIndex).toContain("`receiptHash` CHAR(64)");expect(legacyIndex).toContain("SHA2(CONCAT(");expect(legacyIndex).toContain("LeadCommandReceipt_receiptHash_key");expect(legacyIndex).not.toContain("DROP TABLE");});
  it("links list rows to scoped detail with edit and convert forms",()=>{expect(listPage).toContain("/leads/${lead.id}");expect(detailPage).toContain("buildLeadScopeWhere(context)");expect(detailPage).toContain("<LeadEditForm");expect(detailPage).toContain("<LeadConvertForm");});
  it("expands Lead management without destructive schema operations",()=>{expect(schema).toContain("model LeadStatusHistory");expect(schema).toContain("model LeadAssignmentHistory");expect(schema).toContain("model Campaign");expect(schema).toContain("model LeadNumberSequence");expect(schema).toContain("firstContactDueAt");expect(schema).toContain("mergedIntoLeadId");expect(expansion).toContain("Opportunity_sourceLeadId_key");expect(expansion).toContain("Lead_organizationUnitId_ownerId_status_idx");expect(expansion).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);});
  it("adds saved views and configurable assignment rules additively",()=>{expect(schema).toContain("model LeadSavedView");expect(schema).toContain("model LeadAssignmentRule");expect(operations).toContain("LeadSavedView");expect(operations).toContain("LeadAssignmentRule");expect(operations).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);});
});

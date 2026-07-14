import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read=(path:string)=>readFileSync(path,"utf8");

describe("Deletion and data-retention contract",()=>{
  it("uses an additive schema and recoverable Prospect deletion",()=>{const schema=read("prisma/schema.prisma"),migration=read("prisma/migrations/20260717090000_add_data_retention_policy/migration.sql");expect(schema).toContain("deleteReason");expect(schema).toContain("EXPIRED");expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);expect(migration).toContain("prospect.soft_delete");expect(migration).toContain("prospect.restore");});
  it("keeps normal Prospect queries scoped away from deleted records",()=>{const authorization=read("lib/prospect/prospect-authorization.ts");expect(authorization).toContain("deletedAt: null");});
  it("provides governed UI actions without Lead, Opportunity, or Customer hard delete",()=>{const actions=read("components/data-retention-actions.tsx"),lead=read("components/lead-workflow-forms.tsx"),opportunity=read("components/workflow-forms.tsx");expect(actions).toContain("ลบแบบกู้คืนได้");expect(actions).toContain("กู้คืน");expect(lead).toContain("Archive Lead");expect(lead).toContain("Mark Invalid");expect(opportunity).toContain('value="EXPIRE"');});
});

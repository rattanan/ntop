import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read=(path:string)=>readFileSync(path,"utf8");
describe("Proposal REST and migration contract",()=>{
  it("enforces scoped server actors and idempotency on every mutation",()=>{for(const route of ["app/api/v1/proposals/route.ts","app/api/v1/proposals/[id]/route.ts","app/api/v1/proposals/[id]/restore/route.ts","app/api/v1/proposals/[id]/status/route.ts","app/api/v1/proposals/[id]/generate/route.ts"]){const source=read(route);expect(source).toContain("getSession");expect(source).toContain("proposalActor");}for(const route of ["app/api/v1/proposals/route.ts","app/api/v1/proposals/[id]/route.ts","app/api/v1/proposals/[id]/restore/route.ts","app/api/v1/proposals/[id]/status/route.ts","app/api/v1/proposals/[id]/generate/route.ts"]){expect(read(route)).toContain("requireIdempotencyKey");}});
  it("keeps Quote linkage optional and migration expand-only",()=>{expect(read("app/api/v1/quotes/route.ts")).toContain("proposalId: z.string");const migration=read("prisma/migrations/20260715190000_add_proposal_management/migration.sql");expect(migration).toContain("ADD COLUMN `proposalId`");expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN/);});
  it("keeps provider model configurable and AI output strictly parsed",()=>{const route=read("app/api/v1/proposals/[id]/generate/route.ts");expect(route).toContain("createActiveProviderClient");expect(route).not.toContain('model: "');expect(read("lib/proposal/proposal-ai-service.ts")).toContain("parseProposalAiOutput");});
});

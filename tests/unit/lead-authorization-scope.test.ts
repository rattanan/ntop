import { describe, expect, it } from "vitest";
import { buildLeadScopeWhere } from "../../lib/lead/prisma-lead-repository";

describe("Lead authorization scope", () => {
  it("bounds team reads to actor or assigned organization unit", () => {
    expect(buildLeadScopeWhere({ actorId: "manager", assignments: [{ role: "TEAM_MANAGER", scope: "TEAM", organizationUnitId: "team-1" }] })).toEqual({ OR: [{ ownerId: "manager", organizationUnitId: null }, { organizationUnitId: { in: ["team-1"] } }] });
  });
  it("does not let enterprise capability bypass organization visibility", () => {
    expect(buildLeadScopeWhere({ actorId: "admin", assignments: [{ role: "ADMIN", scope: "ENTERPRISE", organizationUnitId: null }] })).toEqual({ OR: [{ ownerId: "admin", organizationUnitId: null }] });
  });
  it("limits solution architect organization scope to qualified Leads",()=>{expect(buildLeadScopeWhere({actorId:"architect",assignments:[{role:"SOLUTION_ARCHITECT",scope:"ORG_UNIT",organizationUnitId:"team-1"}]})).toEqual({AND:[{OR:[{ownerId:"architect",organizationUnitId:null},{organizationUnitId:{in:["team-1"]}}]},{status:"QUALIFIED"}]});});
});

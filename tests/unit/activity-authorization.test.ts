import { describe, expect, it } from "vitest";

import { buildActivityScopeWhere } from "../../lib/activity/activity-authorization";

describe("Activity authorization scope", () => {
  it("lets an owner access their own related Activities", () => {
    expect(buildActivityScopeWhere({
      actorId: "owner-1",
      assignments: [{ role: "KAM", scope: "SELF", organizationUnitId: null }],
    })).toEqual({ OR: [{ ownerId: "owner-1" }] });
  });

  it("adds organization-related Activities without exposing other organizations", () => {
    expect(buildActivityScopeWhere({
      actorId: "manager-1",
      assignments: [{ role: "TEAM_MANAGER", scope: "ORG_UNIT", organizationUnitId: "org-1" }],
      organizationUnitIds: ["org-1", "org-child"],
    })).toEqual({
      OR: [
        { ownerId: "manager-1" },
        { customer: { OR: [{ ownerId: "manager-1", organizationUnitId: null }, { organizationUnitId: { in: ["org-1", "org-child"] } }] } },
        { opportunity: { OR: [{ ownerId: "manager-1", organizationUnitId: null }, { organizationUnitId: { in: ["org-1", "org-child"] } }] } },
        { lead: { OR: [{ ownerId: "manager-1", organizationUnitId: null }, { organizationUnitId: { in: ["org-1", "org-child"] } }] } },
        { prospect: { OR: [
          { ownerId: "manager-1", responsibleBusinessUnitId: null, salesTeamId: null },
          { backupOwnerId: "manager-1", responsibleBusinessUnitId: null, salesTeamId: null },
          { responsibleBusinessUnitId: { in: ["org-1", "org-child"] } },
          { salesTeamId: { in: ["org-1", "org-child"] } },
        ] } },
      ],
    });
  });
});

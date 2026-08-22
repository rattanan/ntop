import { describe, expect, it } from "vitest";

import {
  authorizedOrganizationUnitIds,
  buildAuthorizedUserWhere,
  expandOrganizationScopeIds,
  type AuthorizationContext,
} from "../../lib/authorization/authorization-context";
import { buildContractScopeWhere } from "../../lib/contract/prisma-contract-repository";
import { buildCustomerScopeWhere } from "../../lib/customer/customer-query-service";
import { buildOpportunityScopeWhere } from "../../lib/opportunity/opportunity-query";

const units = [
  { id: "aor", parentId: null },
  { id: "aor-3", parentId: "aor" },
  { id: "aor-4", parentId: "aor" },
  { id: "aor-3-1", parentId: "aor-3" },
];

function context(actorId: string, organizationUnitIds: string[]): AuthorizationContext {
  return {
    actorId,
    assignments: [{ role: "ADMIN", scope: "ENTERPRISE", organizationUnitId: organizationUnitIds[0] ?? null }],
    organizationUnitIds,
  };
}

describe("organization hierarchy authorization", () => {
  it("expands a parent organization to itself and all descendants", () => {
    expect(expandOrganizationScopeIds(["aor"], units)).toEqual(["aor", "aor-3", "aor-4", "aor-3-1"]);
  });

  it("does not expand a child to its parent or sibling", () => {
    expect(expandOrganizationScopeIds(["aor-3"], units)).toEqual(["aor-3", "aor-3-1"]);
  });

  it("ignores inactive or unknown direct units", () => {
    expect(expandOrganizationScopeIds(["inactive"], units)).toEqual([]);
  });

  it("uses the expanded IDs consistently for business records", () => {
    const authorization = context("parent-user", ["aor", "aor-3", "aor-4", "aor-3-1"]);
    const expected = {
      OR: [
        { ownerId: "parent-user", organizationUnitId: null },
        { organizationUnitId: { in: ["aor", "aor-3", "aor-4", "aor-3-1"] } },
      ],
    };
    expect(authorizedOrganizationUnitIds(authorization)).toEqual(["aor", "aor-3", "aor-4", "aor-3-1"]);
    expect(buildCustomerScopeWhere(authorization)).toEqual(expected);
    expect(buildOpportunityScopeWhere(authorization)).toEqual(expected);
    expect(buildContractScopeWhere(authorization)).toEqual(expected);
  });

  it("limits assignable users to the same organization subtree", () => {
    const authorization = context("child-user", ["aor-3", "aor-3-1"]);
    expect(buildAuthorizedUserWhere(authorization, new Date("2026-08-22T00:00:00.000Z"))).toEqual({
      active: true,
      OR: [
        { id: "child-user" },
        {
          enterpriseRoleAssignments: {
            some: {
              active: true,
              effectiveFrom: { lte: new Date("2026-08-22T00:00:00.000Z") },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date("2026-08-22T00:00:00.000Z") } }],
              organizationUnitId: { in: ["aor-3", "aor-3-1"] },
            },
          },
        },
      ],
    });
  });
});

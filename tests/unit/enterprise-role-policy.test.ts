import { describe, expect, it } from "vitest";

import {
  isAuthorizationScope,
  isEnterpriseRole,
  legacyRoleAssignment,
} from "../../lib/authorization/enterprise-role-policy";

describe("enterprise role compatibility bridge", () => {
  it("maps legacy roles without expanding their authority", () => {
    expect(legacyRoleAssignment("ADMIN")).toEqual({
      role: "ADMIN",
      scope: "ENTERPRISE",
      organizationUnitId: null,
    });
    expect(legacyRoleAssignment("SALES")).toEqual({
      role: "KAM",
      scope: "SELF",
      organizationUnitId: null,
    });
    expect(legacyRoleAssignment("VIEWER")).toEqual({
      role: "VIEWER",
      scope: "SELF",
      organizationUnitId: null,
    });
  });

  it("rejects unknown role and scope codes", () => {
    expect(isEnterpriseRole("PRICING_APPROVER")).toBe(true);
    expect(isEnterpriseRole("MARKETING")).toBe(true);
    expect(isEnterpriseRole("SOLUTION_ARCHITECT")).toBe(true);
    expect(isEnterpriseRole("SUPER_ADMIN")).toBe(false);
    expect(isAuthorizationScope("ORG_UNIT")).toBe(true);
    expect(isAuthorizationScope("GLOBAL_WRITE")).toBe(false);
  });
});

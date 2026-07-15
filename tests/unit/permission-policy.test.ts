import type { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  assertPermission,
  PERMISSIONS,
  PermissionDeniedError,
  permissionPolicy,
  type Permission,
} from "../../lib/authorization/permission-policy";

const expectedPermissions: Record<Role, readonly Permission[]> = {
  ADMIN: Object.values(PERMISSIONS),
  SALES: [
    PERMISSIONS.recordViewOwned,
    PERMISSIONS.recordCreate,
    PERMISSIONS.recordUpdate,
    PERMISSIONS.aiMeetingDraftConfirm,
    PERMISSIONS.aiRiskExplain,
    PERMISSIONS.opportunityTransition,
    PERMISSIONS.quoteManage,
    PERMISSIONS.quoteSubmit,
    PERMISSIONS.proposalView,
    PERMISSIONS.proposalManage,
    PERMISSIONS.contractView,
    PERMISSIONS.contractManage,
    PERMISSIONS.contractSignatureManage,
    PERMISSIONS.contractServiceOrderCreate,
  ],
  VIEWER: [PERMISSIONS.recordViewOwned, PERMISSIONS.proposalView, PERMISSIONS.contractView],
};

describe("legacy role permission policy", () => {
  it.each(Object.entries(expectedPermissions) as [Role, readonly Permission[]][])(
    "preserves the allowed behavior for %s",
    (role, allowedPermissions) => {
      for (const permission of Object.values(PERMISSIONS)) {
        expect(permissionPolicy.allows({ role }, permission)).toBe(
          allowedPermissions.includes(permission),
        );
      }
    },
  );

  it("allows only ADMIN to manage AI provider configuration", () => {
    expect(
      permissionPolicy.allows(
        { role: "ADMIN" },
        PERMISSIONS.aiConfigManage,
      ),
    ).toBe(true);
    expect(
      permissionPolicy.allows(
        { role: "SALES" },
        PERMISSIONS.aiConfigManage,
      ),
    ).toBe(false);
    expect(
      permissionPolicy.allows(
        { role: "VIEWER" },
        PERMISSIONS.aiConfigManage,
      ),
    ).toBe(false);
  });

  it("allows Sales to request optional risk explanations but denies Viewer", () => {
    expect(
      permissionPolicy.allows({ role: "SALES" }, PERMISSIONS.aiRiskExplain),
    ).toBe(true);
    expect(
      permissionPolicy.allows({ role: "VIEWER" }, PERMISSIONS.aiRiskExplain),
    ).toBe(false);
  });

  it("allows Sales to manage Proposal while Viewer remains read-only", () => {
    expect(permissionPolicy.allows({ role: "SALES" }, PERMISSIONS.proposalManage)).toBe(true);
    expect(permissionPolicy.allows({ role: "VIEWER" }, PERMISSIONS.proposalView)).toBe(true);
    expect(permissionPolicy.allows({ role: "VIEWER" }, PERMISSIONS.proposalManage)).toBe(false);
  });

  it("keeps Contract mutation server-side while Viewer remains read-only", () => {
    expect(permissionPolicy.allows({ role: "SALES" }, PERMISSIONS.contractManage)).toBe(true);
    expect(permissionPolicy.allows({ role: "VIEWER" }, PERMISSIONS.contractView)).toBe(true);
    expect(permissionPolicy.allows({ role: "VIEWER" }, PERMISSIONS.contractManage)).toBe(false);
    expect(permissionPolicy.allows({ role: "SALES" }, PERMISSIONS.contractApprove)).toBe(false);
  });

  it("restricts customer merge to the configured privileged permission", () => {
    expect(
      permissionPolicy.allows({ role: "ADMIN" }, PERMISSIONS.customerMerge),
    ).toBe(true);
    expect(
      permissionPolicy.allows({ role: "SALES" }, PERMISSIONS.customerMerge),
    ).toBe(false);
  });

  it("restricts audit history to the configured privileged permission", () => {
    expect(permissionPolicy.allows({ role: "ADMIN" }, PERMISSIONS.auditRead)).toBe(true);
    expect(permissionPolicy.allows({ role: "SALES" }, PERMISSIONS.auditRead)).toBe(false);
    expect(permissionPolicy.allows({ role: "VIEWER" }, PERMISSIONS.auditRead)).toBe(false);
  });

  it("fails closed with a permission-specific server error", () => {
    expect(() =>
      assertPermission({ role: "SALES" }, PERMISSIONS.aiConfigManage),
    ).toThrow(PermissionDeniedError);
    expect(() =>
      assertPermission({ role: "SALES" }, PERMISSIONS.aiConfigManage),
    ).toThrow("Permission denied: ai.config.manage");
  });
});

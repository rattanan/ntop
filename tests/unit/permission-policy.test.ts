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
  ],
  VIEWER: [PERMISSIONS.recordViewOwned],
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

  it("fails closed with a permission-specific server error", () => {
    expect(() =>
      assertPermission({ role: "SALES" }, PERMISSIONS.aiConfigManage),
    ).toThrow(PermissionDeniedError);
    expect(() =>
      assertPermission({ role: "SALES" }, PERMISSIONS.aiConfigManage),
    ).toThrow("Permission denied: ai.config.manage");
  });
});

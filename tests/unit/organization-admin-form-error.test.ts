import { describe, expect, it } from "vitest";

import { organizationAdminValidationMessage } from "../../lib/administration/organization-admin-form-error";
import {
  assignOrganizationApproverSchema,
  createOrganizationUnitSchema,
  updateOrganizationHierarchySchema,
} from "../../lib/administration/organization-admin-service";

function validationError(result: { success: boolean; error?: unknown }) {
  expect(result.success).toBe(false);
  return result.error;
}

describe("organizationAdminValidationMessage", () => {
  it("explains the organization code rule without exposing the raw Zod error", () => {
    const result = createOrganizationUnitSchema.safeParse({
      code: "ฝ่ายขาย",
      name: "ฝ่ายขาย",
      parentId: null,
    });

    const message = organizationAdminValidationMessage(validationError(result));

    expect(message).toContain("รหัสหน่วยงานต้องมี 2–100 ตัวอักษร");
    expect(message).toContain("A–Z, 0–9");
    expect(message).not.toContain("invalid_format");
    expect(message).not.toContain("regex");
  });

  it("maps required organization and approver fields to user-facing messages", () => {
    const hierarchy = updateOrganizationHierarchySchema.safeParse({
      organizationUnitId: "",
      parentId: null,
    });
    const approver = assignOrganizationApproverSchema.safeParse({
      userId: "user-1",
      organizationUnitId: "org-1",
      roleCode: "TEAM_MANAGER",
      maximumAmount: "100.12345",
      customerSegment: null,
      effectiveFrom: new Date("2026-08-22T00:00:00+07:00"),
      effectiveTo: null,
    });

    expect(organizationAdminValidationMessage(validationError(hierarchy))).toBe(
      "กรุณาเลือกหน่วยงาน",
    );
    expect(organizationAdminValidationMessage(validationError(approver))).toContain(
      "ทศนิยมได้ไม่เกิน 4 ตำแหน่ง",
    );
  });

  it("does not replace non-validation domain errors", () => {
    expect(organizationAdminValidationMessage(new Error("domain error"))).toBeNull();
  });
});

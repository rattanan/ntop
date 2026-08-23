import { describe, expect, it } from "vitest";

import { organizationAdminValidationMessage } from "../../lib/administration/organization-admin-form-error";
import {
  assignOrganizationApproverSchema,
  createOrganizationUnitSchema,
  removeOrganizationUnitSchema,
  updateOrganizationHierarchySchema,
} from "../../lib/administration/organization-admin-service";
import { ORGANIZATION_CODE_PATTERN_SOURCE } from "../../lib/administration/organization-code";

function validationError(result: { success: boolean; error?: unknown }) {
  expect(result.success).toBe(false);
  return result.error;
}

describe("organizationAdminValidationMessage", () => {
  it.each(["ออธ", "ออธ.3", "SALES-CENTRAL", "sales.central_3"])(
    "accepts the supported organization code %s",
    (code) => {
      const result = createOrganizationUnitSchema.safeParse({
        code,
        name: "หน่วยงานทดสอบ",
        parentId: null,
      });

      expect(result.success).toBe(true);
      if (result.success && code === "sales.central_3") {
        expect(result.data.code).toBe("SALES.CENTRAL_3");
      }
    },
  );

  it.each([".ออธ", "-SALES", "ออธ 3", "ออธ@3"])(
    "rejects the unsupported organization code %s",
    (code) => {
      const result = createOrganizationUnitSchema.safeParse({
        code,
        name: "หน่วยงานทดสอบ",
        parentId: null,
      });

      expect(result.success).toBe(false);
    },
  );

  it("uses an HTML-compatible pattern with the same Thai code behavior", () => {
    const browserPattern = new RegExp(
      `^(?:${ORGANIZATION_CODE_PATTERN_SOURCE})$`,
      "v",
    );

    expect(browserPattern.test("ออธ")).toBe(true);
    expect(browserPattern.test("ออธ.3")).toBe(true);
    expect(browserPattern.test("SALES-CENTRAL")).toBe(true);
    expect(browserPattern.test(".ออธ")).toBe(false);
    expect(browserPattern.test("ออธ 3")).toBe(false);
  });

  it("explains the organization code rule without exposing the raw Zod error", () => {
    const result = createOrganizationUnitSchema.safeParse({
      code: "ออธ 3",
      name: "หน่วยงานทดสอบ",
      parentId: null,
    });

    const message = organizationAdminValidationMessage(validationError(result));

    expect(message).toContain("รหัสหน่วยงานต้องมี 2–100 ตัวอักษร");
    expect(message).toContain("รวมภาษาไทยและอังกฤษ");
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

  it("requires a meaningful reason when removing an organization", () => {
    const result = removeOrganizationUnitSchema.safeParse({
      organizationUnitId: "org-1",
      reason: "ลบ",
    });

    expect(organizationAdminValidationMessage(validationError(result))).toContain(
      "อย่างน้อย 5 ตัวอักษร",
    );
  });
});

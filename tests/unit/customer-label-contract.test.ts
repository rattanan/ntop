import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const navigation = readFileSync("components/app-navigation.ts", "utf8");
const customerPage = readFileSync("app/(portal)/customers/page.tsx", "utf8");
const customerCreatePage = readFileSync("app/(portal)/customers/new/page.tsx", "utf8");
const labelSources = [
  "components/forms.tsx",
  "components/customer-table.tsx",
  "components/record-list.tsx",
  "components/customer-governance-actions.tsx",
  "components/customer-contact-form.tsx",
  "components/activity-management.tsx",
  "components/meeting-draft-review-form.tsx",
  "components/pipeline-dashboard.tsx",
  "components/prospect-form.tsx",
  "components/lead-workflow-forms.tsx",
  "app/(portal)/activities/page.tsx",
  "app/(portal)/coverage/page.tsx",
  "app/(portal)/quotes/page.tsx",
].map((file) => ({ file, source: readFileSync(file, "utf8") }));

describe("Customer UI terminology", () => {
  it("uses Customer in navigation and Quick Create", () => {
    expect(navigation).toContain('label: "Customer", href: "/customers"');
    expect(navigation).toContain('label: "สร้าง Customer", href: "/customers/new"');
  });

  it("uses Customer in customer page headings and actions", () => {
    expect(customerPage).toContain("Customer องค์กร");
    expect(customerPage).toContain("สร้าง Customer");
    expect(customerCreatePage).toContain("สร้าง Customer ใหม่");
  });

  it("does not expose the old Thai entity name in labels or table headings", () => {
    for (const { file, source } of labelSources) {
      expect(source, file).not.toMatch(/label="[^"]*ลูกค้า|<th>[^<]*ลูกค้า|<span>ลูกค้า<\/span>/);
    }
  });
});

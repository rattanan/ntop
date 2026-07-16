import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync("prisma/seed.ts", "utf8");
const enterpriseRoles = readFileSync(
  "lib/authorization/enterprise-role-policy.ts",
  "utf8",
);

describe("Enterprise Sales E2E seed contract", () => {
  it("provides synthetic accounts for every workflow handoff role", () => {
    for (const account of [
      "sales1@example.test",
      "manager@example.test",
      "director@example.test",
      "presales@example.test",
      "pricing@example.test",
      "legal@example.test",
      "contract@example.test",
    ]) {
      expect(seed).toContain(account);
    }
    expect(seed).toContain("process.env.SEED_ADMIN_EMAIL");
  });

  it("recognizes legal and order-operations assignments server-side", () => {
    expect(enterpriseRoles).toContain('"LEGAL"');
    expect(enterpriseRoles).toContain('"ORDER_OPERATIONS"');
    expect(seed).toContain(
      'ORDER_OPERATIONS:["contract.view","contract.manage","contract.signature.manage","contract.service-order.create"]',
    );
  });

  it("requires the demo password through environment configuration", () => {
    expect(seed).toContain("process.env.SEED_DEMO_PASSWORD");
    expect(seed).not.toMatch(/SEED_DEMO_PASSWORD\s*=\s*["']/);
  });
});

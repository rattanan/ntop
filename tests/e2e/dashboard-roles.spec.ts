import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const password = process.env.E2E_PASSWORD;
const prisma = new PrismaClient();
test.afterAll(async () => prisma.$disconnect());

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password ?? "");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);
  await expect(page.getByTestId("enterprise-dashboard")).toBeVisible();
}

test.describe("role-aware enterprise dashboard", () => {
  test.skip(!password, "Set E2E_PASSWORD to the seeded dashboard test-account password.");
  test.describe.configure({ mode: "serial" });

  const roleCases = [
    ["executive@example.test", "executive", "solution"],
    ["sales1@example.test", "sales", "admin"],
    ["manager@example.test", "salesManager", "admin"],
    ["architect@example.test", "solution", "operations"],
    ["pricing@example.test", "approver", "sales"],
    ["contract@example.test", "operations", "admin"],
    ["success@example.test", "customerSuccess", "executive"],
    ["admin-dashboard@example.test", "admin", "viewer"],
  ] as const;

  for (const [email, visibleSection, forbiddenSection] of roleCases) {
    test(`${visibleSection} sees only permission-granted role intelligence after login`, async ({ page }) => {
      await login(page, email);
      await expect(page.getByTestId("dashboard-kpis")).toBeVisible();
      await expect(page.getByTestId("chart-stage")).toBeVisible();
      await expect(page.locator(`[data-dashboard-section="${visibleSection}"]`)).toBeVisible();
      await expect(page.locator(`[data-dashboard-section="${forbiddenSection}"]`)).toHaveCount(0);
      await expect(page.locator('.app-sidebar a[href="/prospects"]')).toHaveCount(1);
      const continuation = page.locator(`[data-dashboard-section="${visibleSection}"] a`).first();
      await expect(continuation).toHaveAttribute("href", /^\//);
      if (visibleSection === "admin") await expect(page.locator('.app-sidebar a[href="/admin/users"]')).toBeVisible();
      else if (forbiddenSection === "admin") await expect(page.locator('a[href="/admin/users"]')).toHaveCount(0);

      const response = await page.request.get("/api/v1/dashboard");
      expect(response.ok()).toBe(true);
      const body = await response.json();
      expect(body.data.permissions.sections).toContain(visibleSection);
      expect(body.data.permissions.sections).not.toContain(forbiddenSection);
      const leadValue = body.data.kpis.find((item: { key: string }) => item.key === "leads").value;
      await expect(page.locator('[data-metric="leads"]')).toContainText(Number(leadValue).toLocaleString("th-TH"));
    });
  }

  test("SELF scope rejects another owner and renders permission denied without leaking data", async ({ page }) => {
    const otherOwner = await prisma.user.findUniqueOrThrow({ where: { email: "sales2@example.test" }, select: { id: true } });
    await login(page, "sales1@example.test");
    const response = await page.request.get(`/api/v1/dashboard?ownerId=${encodeURIComponent(otherOwner.id)}`);
    expect(response.status()).toBe(403);
    await page.goto(`/dashboard?ownerId=${encodeURIComponent(otherOwner.id)}`);
    await expect(page.getByTestId("dashboard-permission-denied")).toBeVisible();
    await expect(page.getByTestId("dashboard-kpis")).toHaveCount(0);
  });

  test("filters persist, KPI drill-down works, export is scoped, and dark mode is retained", async ({ page }) => {
    await login(page, "sales1@example.test");
    await page.locator('[data-metric="opportunities"]').click();
    await expect(page).toHaveURL(/\/opportunities/);
    await page.goto("/dashboard");

    await page.locator('select[name="status"]').selectOption("QUALIFY");
    await page.getByRole("button", { name: "ใช้ Filter" }).click();
    await expect(page).toHaveURL(/status=QUALIFY/);
    expect(await page.evaluate(() => localStorage.getItem("ntop-dashboard-filters"))).toContain("status=QUALIFY");

    const exportResponse = await page.request.get("/api/v1/dashboard/export?status=QUALIFY&format=csv");
    expect(exportResponse.ok()).toBe(true);
    expect(exportResponse.headers()["content-type"]).toContain("text/csv");
    expect(await exportResponse.text()).toContain("category,metric,count,value,source");

    await page.goto("/opportunities");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/status=QUALIFY/);

    await page.getByRole("button", { name: "ใช้โหมดมืด" }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
    await page.reload();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  });

  test("responsive dashboard has no page-level horizontal overflow", async ({ page }) => {
    await login(page, "manager@example.test");
    for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      await test.step(`${viewport.width}x${viewport.height}`, async () => {
        await page.setViewportSize(viewport);
        await expect(page.getByTestId("enterprise-dashboard")).toBeVisible();
        await expect.poll(
          () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
        ).toBe(true);
      });
    }
  });

  test("empty and recoverable error states are reachable", async ({ page }) => {
    await login(page, "sales1@example.test");
    await page.goto("/dashboard?from=2099-01-01&to=2099-01-31");
    await expect(page.getByTestId("dashboard-empty")).toBeVisible();
    await page.goto("/dashboard?from=invalid");
    await expect(page.getByTestId("dashboard-error")).toBeVisible();
  });
});

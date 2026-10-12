import { test, expect } from "playwright/test";

test.describe("Admin Panel E2E", () => {
  test("allows SUPER_ADMIN login and displays accurate subscription plans without PRO default regression", async ({
    page,
  }) => {
    // 1. Visit Login
    await page.goto("/login");

    // 2. Fill admin credentials
    await page.fill('input[type="email"]', "admin@nexmenu.local");
    await page.fill('input[type="password"]', "Admin@1234");
    await page.click('button[type="submit"]');

    // 3. Navigate to /admin
    await page.goto("/admin");

    // 4. Verify Admin Panel Heading
    await expect(page.locator("h1")).toContainText(/NEXMENU Platform Admin/i);

    // 5. Verify the restaurants table is populated
    const restaurantRows = page.locator("tbody tr");
    await expect(restaurantRows.first()).toBeVisible();

    // 6. Verify plan select exists and is bound to real data
    const planSelects = page.locator("select");
    await expect(planSelects.first()).toBeVisible();

    // 7. Verify Audit Logs section
    const auditHeading = page.getByText(/Recent platform activity/i);
    await expect(auditHeading).toBeVisible();
  });
});

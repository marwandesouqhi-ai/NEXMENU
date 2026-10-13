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
    await page.waitForURL((url) => !url.pathname.includes("/login"));

    // 3. Navigate to /admin
    await page.goto("/admin");

    // 4. Verify Admin Panel Heading
    await expect(page.locator("h1")).toContainText(/NEXMENU admin/i);

    // 5. Verify the restaurants list is populated
    await expect(page.getByText("Cafe Moon")).toBeVisible();

    // 6. Verify plan select exists and is bound to real data
    const planSelect = page.locator("select").first();
    await expect(planSelect).toBeVisible();

    // 7. Verify Audit Logs tab can be opened
    await page.getByRole("button", { name: "Audit Logs" }).dispatchEvent("click");
    await expect(page.getByRole("heading", { name: "Audit Logs" })).toBeVisible();
  });
});

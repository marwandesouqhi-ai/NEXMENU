import { test, expect } from "playwright/test";

test.describe("Public Menu E2E", () => {
  test("renders public menu with branding, categories, and dishes", async ({ page }) => {
    // Navigate to default seed restaurant (Cafe Moon)
    await page.goto("/r/cafe-moon");

    // Check restaurant header and title
    await expect(page.locator("h1")).toContainText("Cafe Moon");
    await expect(page).toHaveTitle(/Cafe Moon/i);

    // Check category navigation tabs
    const nav = page.locator('nav[aria-label="Menu categories"]');
    await expect(nav).toBeVisible();

    // Check product list is rendered
    const products = page.locator("button.group");
    await expect(products.first()).toBeVisible();
  });

  test("evaluates OPEN NOW badge with mocked system clock", async ({ page }) => {
    // Mock clock to Friday 12:00 Cairo time (when Friday shift is active)
    await page.clock.setFixedTime(new Date("2026-01-16T10:00:00Z"));
    await page.goto("/r/cafe-moon");

    // Wait for page to render
    await expect(page.locator("h1")).toContainText("Cafe Moon");

    // Check Open badge is present
    const openBadge = page.locator("header").getByText(/open/i);
    await expect(openBadge).toBeVisible();
  });

  test("constrained container respects max-width 820px on mobile viewport (375px)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/r/cafe-moon");

    // Wait for page to render
    await expect(page.locator("h1")).toContainText("Cafe Moon");

    const mainContainer = page.locator("main.menu-root");
    await expect(mainContainer).toBeVisible();

    const box = await mainContainer.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(820);
    expect(box?.width).toBeGreaterThanOrEqual(370);
  });
});

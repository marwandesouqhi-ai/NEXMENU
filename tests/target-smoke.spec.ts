import { test, expect } from "playwright/test";

test.describe("Target Architecture Smoke Tests", () => {
  test("displays 404 Not Found for non-existent paths", async ({ page }) => {
    await page.goto("/non-existent-page-slug-xyz");
    await expect(page.getByText("Page not found")).toBeVisible();
    await expect(page.getByText("The page you’re looking for does not exist.")).toBeVisible();
  });

  test("public menu route /r/cafe-moon is fully rendered with restaurant branding", async ({
    page,
  }) => {
    await page.goto("/r/cafe-moon");
    await expect(page.locator("h1")).toContainText("Cafe Moon");
    await expect(page.locator("main.menu-root")).toBeVisible();
  });
});

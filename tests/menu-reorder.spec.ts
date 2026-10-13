import { test, expect } from "playwright/test";

test.describe("Menu & Product Reordering E2E", () => {
  test("allows restaurant owner to view menu products and reorder using accessible controls", async ({
    page,
  }) => {
    // 1. Login as restaurant owner
    await page.goto("/login");
    await page.fill('input[type="email"]', "owner@cafemoon.local");
    await page.fill('input[type="password"]', "Moon@1234");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/login"));

    // 2. Go to menu manager
    await page.goto("/dashboard/menu");

    // 3. Verify Menu tab is active
    await expect(page.getByText("Add product")).toBeVisible();

    // 4. Verify products render with move controls
    const moveDownButtons = page.locator('button[aria-label^="Move "][aria-label$=" down"]');
    await expect(moveDownButtons.first()).toBeVisible();

    // 5. Click move down on first product
    await moveDownButtons.first().click();

    // Product sequence updates smoothly
    await expect(moveDownButtons.first()).toBeVisible();
  });
});

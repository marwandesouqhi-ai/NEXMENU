import { test, expect } from "playwright/test";

test.describe("Branding Contrast & WCAG Audit E2E", () => {
  test("displays WCAG contrast status and blocks save on illegible color pairs", async ({
    page,
  }) => {
    // 1. Login as restaurant owner
    await page.goto("/login");
    await page.fill('input[type="email"]', "owner@cafemoon.local");
    await page.fill('input[type="password"]', "Moon@1234");
    await page.click('button[type="submit"]');

    // 2. Go to branding
    await page.goto("/dashboard/branding");

    // 3. Verify WCAG Contrast Audit panel
    await expect(page.getByText("WCAG 2.1 Contrast Audit")).toBeVisible();
    await expect(page.getByText("Text on Background")).toBeVisible();

    // 4. Default compliant branding should show Save branding enabled
    const saveButton = page.getByRole("button", { name: "Save branding" });
    await expect(saveButton).toBeEnabled();

    // 5. Change text color to pure white matching white/cream background
    const textInput = page.locator('label:has-text("Text") input[type="color"]');
    await textInput.fill("#f7f4ed");

    // 6. Verify critical fail badge and save button becomes disabled
    await expect(page.getByText(/Critical Fail/i)).toBeVisible();
    await expect(saveButton).toBeDisabled();
    await expect(page.getByText(/Saving is blocked/i)).toBeVisible();
  });
});

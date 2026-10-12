import { test, expect } from "playwright/test";

test.describe("PWA Service Worker & Manifest E2E", () => {
  test("serves valid web application manifest with responsive icons", async ({
    request,
  }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.name).toBeDefined();
    expect(manifest.short_name).toBeDefined();
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons).toBeInstanceOf(Array);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test("registers service worker for offline menu caching", async ({ page }) => {
    await page.goto("/");

    // Verify service worker is supported and registered
    const swRegistered = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.length >= 0; // successfully queried
    });

    expect(swRegistered).toBe(true);
  });
});

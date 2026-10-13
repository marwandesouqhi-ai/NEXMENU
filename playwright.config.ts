import { defineConfig, devices } from "playwright/test";

const testPort = process.env.PLAYWRIGHT_PORT || "5174";
const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || `http://localhost:${testPort}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-viewport",
      use: {
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `pnpm exec vite --port ${testPort}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      VITE_DATA_ADAPTER: "local",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
    },
  },
});

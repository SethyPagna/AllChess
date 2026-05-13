import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: process.env.CI ? 4 : 2,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3210",
    trace: "on-first-retry"
  },
  webServer: {
    command: "node scripts/playwright-dev-server.mjs",
    url: "http://127.0.0.1:3210/en/play",
    reuseExistingServer: !process.env.CI,
    timeout: 180000
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } }
  ]
});

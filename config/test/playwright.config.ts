import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "../../ops/tests/e2e",
  fullyParallel: true,
  workers: process.env.CI ? 4 : 2,
  reporter: "list",
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:3210",
    trace: "on-first-retry"
  },
  webServer: externalBaseUrl ? undefined : {
    command: "node ops/scripts/ops/audit/playwright-dev-server.ts",
    cwd: repoRoot,
    url: "http://127.0.0.1:3210/en/play",
    reuseExistingServer: !process.env.CI,
    timeout: 180000
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } }
  ]
});

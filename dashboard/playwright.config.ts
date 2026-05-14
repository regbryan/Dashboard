import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright smoke + contract test config.
 *
 * Scope: unauthenticated routes only (login, /api/* contract probes,
 * Stripe webhook signature, axe a11y on public pages). Authenticated
 * dashboard E2E needs a Google OAuth fixture — deferred to a follow-up
 * once we wire up a service account.
 *
 * Starts a fresh `next start` server against the prod build for every
 * `npm test` run so we test the same binary that ships.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3411",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run start -- -p 3411",
        url: "http://localhost:3411/login",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

import { defineConfig, devices } from '@playwright/test';

/**
 * Billing E2E config — drives the RUNNING local stack (externally managed).
 *
 *   - hub   : https://hub.wwv.local            (caddy -> wwv-dev-hub container)
 *   - globe : http://localhost:3000            (wwv-dev-globe container)
 *   - db    : postgresql://postgres:postgres@127.0.0.1:5432/worldwideview
 *
 * baseURL is hub.wwv.local (NOT localhost:3001) because the hub sets its
 * Supabase session cookie with `domain: .wwv.local`; a cookie scoped to
 * .wwv.local is rejected by the browser when browsing plain localhost.
 *
 * The flow is serial (workers=1): the three tests share one seeded user,
 * one Stripe checkout session, and one subscription lifecycle.
 */
export default defineConfig({
  timeout: 120000,
  expect: {
    timeout: 30000,
  },
  globalSetup: './tests/billing.global.setup.ts',
  globalTeardown: './tests/billing.global.teardown.ts',
  testDir: './tests',
  testMatch: 'billing-*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  outputDir: 'playwright/output/billing',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright/report/billing', open: 'never' }],
  ],
  use: {
    baseURL: 'https://hub.wwv.local',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/billing-user.json',
      },
    },
  ],
  /* Servers are managed externally — do not auto-boot anything. */
  webServer: [],
});

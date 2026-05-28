import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const MARKETPLACE_DIR = path.resolve(__dir, '../worldwideview-marketplace');
const hasMarketplace = fs.existsSync(MARKETPLACE_DIR);

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  globalSetup: './tests/global.setup.ts',
  globalTeardown: './tests/global.teardown.ts',
  testDir: './tests',
  // web-auth.spec.ts targets worldwideview-web (https://wwv.local:3001) — use playwright.web.config.ts
  // marketplace-from-instance.spec.ts uses playwright.marketplace.config.ts; full-flow requires marketplace repo
  // marketplace-redirect-handshake.spec.ts and marketplace-sign-out.spec.ts require marketplace.wwv.local:3002
  //   — use playwright.cross-app.config.ts for these cross-origin handshake tests
  testIgnore: [
    '**/web-auth.spec.ts',
    '**/marketplace-from-instance.spec.ts',
    '**/marketplace-redirect-handshake.spec.ts',
    '**/marketplace-sign-out.spec.ts',
  ],
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. Restrict to 2 locally to prevent Next.js compilation overload. */
  workers: process.env.CI ? 1 : 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3001',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json'
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'playwright/.auth/user.json',
        launchOptions: {
          firefoxUserPrefs: {
            // Disable MSAA/AT-SPI accessibility layer — causes hangs on Linux CI
            'accessibility.force_disabled': 1,
          },
        },
      },
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        storageState: 'playwright/.auth/user.json'
      },
    },
  ],

  /* Run dev servers before starting the tests */
  webServer: [
    {
      command: 'pnpm dev',
      env: {
        PORT: '3001',
        NEXT_PUBLIC_MARKETPLACE_URL: 'http://localhost:3002',
      },
      url: 'http://localhost:3001',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    // Only start marketplace when the repo is checked out alongside worldwideview.
    // In CI the marketplace dir does not exist — omitting it prevents spawn ENOENT.
    ...(hasMarketplace ? [{
      command: 'pnpm dev',
      cwd: MARKETPLACE_DIR,
      env: { PORT: '3002' },
      url: 'http://localhost:3002',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    }] : []),
  ],
});

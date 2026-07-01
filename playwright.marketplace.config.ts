/**
 * Marketplace-only E2E config.
 * Runs against the marketplace dev server on port 3002 only.
 * No worldwideview auth or Docker/Postgres required.
 *
 * Usage:
 *   pnpm exec playwright test --config=playwright.marketplace.config.ts
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const MARKETPLACE_DIR = path.resolve(__dir, '../worldwideview-marketplace');

export default defineConfig({
    timeout: 30000,
    expect: { timeout: 10000 },
    testDir: './tests',
    testMatch: '**/marketplace-from-instance.spec.ts',
    fullyParallel: false,
    retries: 0,
    workers: 1,
    outputDir: 'playwright/output',
    reporter: 'list',

    use: {
        baseURL: 'http://localhost:3002',
        trace: 'on-first-retry',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    webServer: {
        command: 'pnpm dev',
        cwd: MARKETPLACE_DIR,
        env: { PORT: '3002' },
        url: 'http://localhost:3002',
        reuseExistingServer: true,
        timeout: 90 * 1000,
    },
});

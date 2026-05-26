/**
 * worldwideview-web E2E config.
 * Runs against the web dev server on https://wwv.local:3001.
 * Requires mkcert cert at worldwideview-web/certs/wwv.local+2.pem.
 *
 * Usage:
 *   pnpm exec playwright test --config=playwright.web.config.ts
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(__dir, '../worldwideview-web');

export default defineConfig({
    timeout: 30000,
    expect: { timeout: 10000 },
    testDir: './tests',
    testMatch: '**/web-auth.spec.ts',
    fullyParallel: false,
    retries: 0,
    workers: 1,
    reporter: 'list',

    use: {
        baseURL: 'https://wwv.local:3001',
        ignoreHTTPSErrors: true,
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
        cwd: WEB_DIR,
        url: 'https://wwv.local:3001',
        reuseExistingServer: true,
        timeout: 90 * 1000,
        ignoreHTTPSErrors: true,
    },
});

/**
 * Cross-app E2E config.
 * Starts both worldwideview-web (3001) and worldwideview-marketplace (3002)
 * and runs specs that exercise the shared Supabase cookie handshake across
 * the .wwv.local cookie domain.
 *
 * The marketplace MUST be reachable at https://marketplace.wwv.local:3002
 * (not localhost:3002) because the Supabase auth cookie is scoped to .wwv.local.
 *
 * Usage:
 *   pnpm exec playwright test --config=playwright.cross-app.config.ts
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(__dir, '../worldwideview-web');
const MARKETPLACE_DIR = path.resolve(__dir, '../worldwideview-marketplace');

export default defineConfig({
    timeout: 60000,
    expect: { timeout: 10000 },
    testDir: './tests',
    testMatch: [
        '**/marketplace-redirect-handshake.spec.ts',
        '**/marketplace-sign-out.spec.ts',
    ],
    fullyParallel: false,
    retries: 0,
    workers: 1,
    reporter: 'list',

    use: {
        baseURL: 'https://marketplace.wwv.local:3002',
        ignoreHTTPSErrors: true,
        trace: 'on-first-retry',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    webServer: [
        {
            command: 'pnpm dev',
            cwd: WEB_DIR,
            url: 'https://wwv.local:3001',
            reuseExistingServer: true,
            timeout: 90 * 1000,
            ignoreHTTPSErrors: true,
        },
        {
            command: 'pnpm dev',
            cwd: MARKETPLACE_DIR,
            url: 'https://marketplace.wwv.local:3002',
            reuseExistingServer: true,
            timeout: 90 * 1000,
            ignoreHTTPSErrors: true,
        },
    ],
});

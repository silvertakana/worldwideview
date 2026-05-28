/**
 * Cross-app E2E config.
 * Starts both worldwideview-web (3001) and worldwideview-marketplace (3002)
 * and runs specs that exercise the shared Supabase cookie handshake across
 * the .wwv.local cookie domain.
 *
 * The marketplace MUST be reachable at https://marketplace.wwv.local:3002
 * (not localhost:3002) because the Supabase auth cookie is scoped to .wwv.local.
 *
 * Loads .env.test credentials via Node fs so specs can read them from
 * process.env without requiring a dotenv package install.
 *
 * Usage:
 *   pnpm exec playwright test --config=playwright.cross-app.config.ts
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(__dir, '../worldwideview-web');
const MARKETPLACE_DIR = path.resolve(__dir, '../worldwideview-marketplace');

// Load .env.test credentials into process.env so specs can read them.
// Uses fs directly to avoid a dotenv dependency.
const envTestPath = path.resolve(__dir, '.env.test');
if (fs.existsSync(envTestPath)) {
    const lines = fs.readFileSync(envTestPath, 'utf8').split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (key && !(key in process.env)) process.env[key] = val;
    }
}

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

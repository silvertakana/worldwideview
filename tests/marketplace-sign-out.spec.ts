import { test, expect } from '@playwright/test';

/**
 * Marketplace sign-out spec (REQ-16).
 *
 * Verifies that signing out from the marketplace avatar dropdown:
 *   1. Redirects the user to marketplace home
 *   2. Makes the Sign in link visible again
 *   3. Clears the Supabase session (GET /api/instances returns 401)
 *
 * Requires:
 *   - worldwideview-web running on https://wwv.local:3001
 *   - worldwideview-marketplace running on https://marketplace.wwv.local:3002
 *   - .env.test with PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD
 *
 * Run with:
 *   pnpm exec playwright test --config=playwright.cross-app.config.ts
 */

const WEB_URL = 'https://wwv.local:3001';
const MARKETPLACE_URL = 'https://marketplace.wwv.local:3002';
const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL!;
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD!;

test.describe('marketplace sign-out', () => {
    test('sign out from avatar dropdown returns to marketplace home and clears session', async ({ page }) => {
        // ── Establish authenticated session ──────────────────────────────────
        await page.goto(`${MARKETPLACE_URL}/`);
        await page.getByRole('link', { name: 'Sign in' }).click();
        await page.waitForURL(`${WEB_URL}/**`, { timeout: 15000 });

        await page.fill('input[name="email"]', TEST_EMAIL);
        await page.fill('input[name="password"]', TEST_PASSWORD);
        await page.click('button[type="submit"]');

        // Wait for redirect back to marketplace after login
        await page.waitForURL(`${MARKETPLACE_URL}/**`, { timeout: 15000 });

        // ── Open avatar dropdown and click Sign Out ──────────────────────────
        await page.locator('[aria-haspopup="true"]').click();
        await page.getByRole('menuitem', { name: 'Sign Out' }).click();

        // ── Assert redirect to marketplace home ──────────────────────────────
        await page.waitForURL(`${MARKETPLACE_URL}/`, { timeout: 10000 });

        // Sign in link must be visible again (session cleared on client)
        await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

        // ── Assert session is cleared on the server ──────────────────────────
        const res = await page.request.get(`${MARKETPLACE_URL}/api/instances`);
        expect(res.status()).toBe(401);
    });
});

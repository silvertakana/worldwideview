import { test, expect } from '@playwright/test';

/**
 * Cross-origin redirect handshake specs (REQ-16).
 *
 * Verifies that unauthenticated marketplace visitors are redirected to the
 * auth host with the correct next= param, and that after login they are
 * returned to the exact marketplace page they started from.
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

test.describe('marketplace redirect handshake', () => {
    test('Sign in from /browse preserves current page as next= param', async ({ page }) => {
        await page.goto(`${MARKETPLACE_URL}/browse`);

        // Click the Sign in link in the marketplace header
        await page.getByRole('link', { name: 'Sign in' }).click();

        // Must land on the auth host login page
        await page.waitForURL(`${WEB_URL}/**`, { timeout: 15000 });

        // The next= param must encode the full /browse URL
        expect(page.url()).toContain(`next=${encodeURIComponent(`${MARKETPLACE_URL}/browse`)}`);
    });

    test('Login redirects back to original marketplace page', async ({ page }) => {
        // Start on /browse and click Sign in (same as first test)
        await page.goto(`${MARKETPLACE_URL}/browse`);
        await page.getByRole('link', { name: 'Sign in' }).click();
        await page.waitForURL(`${WEB_URL}/**`, { timeout: 15000 });

        // Fill and submit the login form on the auth host
        await page.fill('input[name="email"]', TEST_EMAIL);
        await page.fill('input[name="password"]', TEST_PASSWORD);
        await page.click('button[type="submit"]');

        // Must be redirected back to the original marketplace page
        await page.waitForURL(`${MARKETPLACE_URL}/browse**`, { timeout: 15000 });

        // Sign in link must no longer be visible (indicates authenticated state)
        await expect(page.getByRole('link', { name: 'Sign in' })).not.toBeVisible();
    });
});

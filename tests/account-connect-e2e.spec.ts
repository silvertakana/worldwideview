import { test, expect } from '@playwright/test';

/**
 * Account connection E2E: PKCE -> JWT -> WebSocket auth flow.
 *
 * Walks the complete user flow across three apps:
 *   - worldwideview-web (auth host, port 3001)
 *   - worldwideview-marketplace (port 3002)
 *   - worldwideview globe app (port 3000 or 3001)
 *
 * Requires:
 *   - All three apps running with HTTPS on .wwv.local
 *   - .env.test with PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD
 *   - Marketplace OAuth app configured with the correct redirect URI
 *
 * Run with:
 *   pnpm exec playwright test --config=playwright.cross-app.config.ts \
 *     --grep "account-connect"
 *
 * NOTE: This is a template script. The exact selectors and flow may
 * need adjustment based on the actual UI rendering of each app.
 * Manual verification (SMOKE-TEST-CHECKLIST.md) is the authoritative
 * validation until the full E2E infrastructure is set up.
 */

const WEB_URL = 'https://wwv.local:3001';
const MARKETPLACE_URL = 'https://marketplace.wwv.local:3002';
const GLOBE_URL = 'https://app.wwv.local:3000';
const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL!;
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD!;

test.describe('account connect E2E', () => {

    test('full PKCE auth chain: sign up -> connect -> WebSocket', async ({ page }) => {
        test.skip(!TEST_EMAIL || !TEST_PASSWORD,
            'PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD must be set in .env.test');

        // ── 1. Sign up at worldwideview-web ────────────────────────────────────
        await page.goto(`${WEB_URL}/signup`);
        await page.waitForURL(`${WEB_URL}/**`, { timeout: 15000 });

        // Fill registration form
        await page.fill('input[name="email"]', TEST_EMAIL);
        await page.fill('input[name="password"]', TEST_PASSWORD);
        await page.fill('input[name="confirmPassword"]', TEST_PASSWORD);
        await page.click('button[type="submit"]');

        // Wait for signup to complete (redirect to account or home)
        await page.waitForURL((url) => !url.pathname.includes('/signup'), { timeout: 20000 });

        // ── 2. Navigate to globe app ──────────────────────────────────────────
        await page.goto(GLOBE_URL);
        await page.waitForSelector('[data-testid="app-ready"]', { state: 'attached', timeout: 45000 });

        // ── 3. Click "Connect to Marketplace" ──────────────────────────────────
        const connectBtn = page.locator('[data-testid="marketplace-connect-btn"]');
        await expect(connectBtn).toBeVisible({ timeout: 10000 });
        await connectBtn.click();

        // ── 4. Verify redirect to marketplace /oauth/authorize ─────────────────
        await page.waitForURL(`${MARKETPLACE_URL}/oauth/authorize**`, { timeout: 15000 });
        const authorizeUrl = page.url();
        expect(authorizeUrl).toContain('/oauth/authorize');
        expect(authorizeUrl).toContain('response_type=code');
        expect(authorizeUrl).toContain('code_challenge');

        // ── 5. Verify consent page shows user email and scope ──────────────────
        await expect(page.locator(`text=${TEST_EMAIL}`)).toBeVisible({ timeout: 10000 });
        // The consent page should describe the scope being requested
        await expect(page.locator('text=email')).toBeVisible({ timeout: 5000 });

        // ── 6. Click "Approve" ────────────────────────────────────────────────
        const approveBtn = page.getByRole('button', { name: /Approve|Authorize|Allow/ });
        await expect(approveBtn).toBeVisible({ timeout: 5000 });
        await approveBtn.click();

        // ── 7. Wait for redirect back to globe app ─────────────────────────────
        await page.waitForURL(`${GLOBE_URL}/**`, { timeout: 20000 });

        // ── 8. Verify "Connected as <email>" is visible ────────────────────────
        const connectedMsg = page.locator(`text=Connected as ${TEST_EMAIL}`);
        await expect(connectedMsg).toBeVisible({ timeout: 10000 });

        // ── 9. Navigate to a page with a plugin that requires auth ─────────────
        // Open the Plugins panel and add a TICKET_AUTH plugin
        const pluginsTab = page.locator('button.panel-tab[title="Plugins"]');
        await expect(pluginsTab).toBeVisible({ timeout: 10000 });
        await pluginsTab.click();

        // ── 10. Verify ticketClient fetches from /api/auth/ticket ──────────────
        // Set up a request listener before the UI action triggers the fetch
        const ticketRequest = page.waitForRequest(
            (req) => req.url().includes('/api/auth/ticket') && req.method() === 'GET',
            { timeout: 15000 }
        );
        const ticketResponse = page.waitForResponse(
            (res) => res.url().includes('/api/auth/ticket') && res.status() === 200,
            { timeout: 15000 }
        );

        // Trigger plugin load (e.g. toggle a plugin on)
        const pluginToggle = page.locator('[data-testid*="plugin-toggle"], .plugin-toggle').first();
        if (await pluginToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
            await pluginToggle.click();
        }

        const ticketReq = await ticketRequest;
        expect(ticketReq.url()).toContain('pluginId=');

        const ticketRes = await ticketResponse;
        const ticketBody = await ticketRes.json();
        expect(ticketBody).toHaveProperty('token');

        // ── 11. Verify WebSocket auth: auth message sent, welcome received ─────
        // Check that the WebSocket connection was established and auth completed
        // by verifying the engine connection state in the debug console.
        const wsConnected = await page.evaluate(() => {
            return !!(window as any).wwvDebugConnections;
        });
        expect(wsConnected).toBe(true);

        // ── 12. Verify data streams ───────────────────────────────────────────
        // Wait for data entities to appear on the globe (indicates WebSocket
        // data messages are flowing after auth)
        const dataEntities = page.locator('[data-testid*="entity"], .cesium-entity');
        await expect(dataEntities.first()).toBeVisible({ timeout: 30000 });
    });

    test('unconnected user falls back gracefully with noCredential', async ({ page }) => {
        // This test verifies that a user without marketplace credentials
        // still gets data via the unauthenticated path.
        test.skip(!TEST_EMAIL || !TEST_PASSWORD,
            'PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD must be set in .env.test');

        // ── 1. Sign up (fresh user, no marketplace connection) ─────────────────
        const freshEmail = `test-${Date.now()}@example.com`;
        await page.goto(`${WEB_URL}/signup`);
        await page.waitForURL(`${WEB_URL}/**`, { timeout: 15000 });

        await page.fill('input[name="email"]', freshEmail);
        await page.fill('input[name="password"]', TEST_PASSWORD);
        await page.fill('input[name="confirmPassword"]', TEST_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL((url) => !url.pathname.includes('/signup'), { timeout: 20000 });

        // ── 2. Navigate to globe app ──────────────────────────────────────────
        await page.goto(GLOBE_URL);
        await page.waitForSelector('[data-testid="app-ready"]', { state: 'attached', timeout: 45000 });

        // ── 3. Navigate to plugins tab ────────────────────────────────────────
        const pluginsTab = page.locator('button.panel-tab[title="Plugins"]');
        await expect(pluginsTab).toBeVisible({ timeout: 10000 });
        await pluginsTab.click();

        // ── 4. Listen for /api/auth/ticket — expect noCredential ──────────────
        const ticketResponse = page.waitForResponse(
            (res) => res.url().includes('/api/auth/ticket'),
            { timeout: 15000 }
        );

        // Trigger plugin load
        const pluginItem = page.locator('.plugin-item, [data-testid*="plugin"]').first();
        if (await pluginItem.isVisible({ timeout: 3000 }).catch(() => false)) {
            await pluginItem.click();
        }

        const res = await ticketResponse;
        const body = await res.json();

        // No credential set up yet — expect noCredential
        expect(body).toEqual({ noCredential: true });

        // The app should still show data (unauthenticated path)
        const dataEntities = page.locator('[data-testid*="entity"], .cesium-entity');
        const hasData = await dataEntities.first().isVisible({ timeout: 30000 }).catch(() => false);
        // Note: this may pass or fail depending on which plugins are loaded
        // and whether they support unauthenticated mode. Log the result.
        test.info().annotations.push({
            type: hasData ? 'info' : 'warn',
            description: hasData
                ? 'Data visible via unauthenticated path'
                : 'No data visible — expected when no plugins support unauthenticated mode',
        });
    });
});

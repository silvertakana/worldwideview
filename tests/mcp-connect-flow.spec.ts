import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from 'better-auth/crypto';
import crypto from 'crypto';

/**
 * The connect flow a brand-new user actually walks:
 *   sign in -> open API & MCP Access -> create a key -> copy the config -> an agent drives the globe.
 *
 * Everything runs on the LOOPBACK IP, not on localhost, on purpose. The harness boots the
 * app with NEXT_PUBLIC_APP_URL=http://localhost:3001 while we browse http://127.0.0.1:3001.
 * That host mismatch is what broke sign-in for real users - the auth client posted
 * cross-origin to a host the server would not trust, and the form rendered no error - so
 * this file is the regression guard for it.
 */

const CONNECT_TEST_EMAIL = 'mcp-connect-e2e@test.local';
const CONNECT_TEST_PASSWORD = 'McpConnectPassword123!';
const LOOPBACK_ORIGIN = 'http://127.0.0.1:3001';

test.describe('MCP connect flow', () => {
    test.describe.configure({ mode: 'serial' });
    test.use({ storageState: { cookies: [], origins: [] } });

    let prisma: PrismaClient;
    let pool: Pool;
    /** The one-time token the panel revealed; step 3 needs it after the page is gone. */
    let issuedToken: string | null = null;
    /** The test user's id, so the spec can check what the panel actually stored. */
    let connectUserId = '';

    test.beforeAll(async () => {
        pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/worldwideview?schema=public' });
        const adapter = new PrismaPg(pool);
        prisma = new PrismaClient({ adapter });

        const hashedPassword = await hashPassword(CONNECT_TEST_PASSWORD);
        const user = await prisma.betterAuthUser.upsert({
            where: { email: CONNECT_TEST_EMAIL },
            update: { name: 'MCP Connect E2E' },
            create: {
                id: crypto.randomUUID(),
                email: CONNECT_TEST_EMAIL,
                name: 'MCP Connect E2E',
                emailVerified: true,
                role: 'user',
            },
        });

        await prisma.betterAuthAccount.deleteMany({ where: { userId: user.id } });
        await prisma.betterAuthAccount.create({
            data: {
                id: crypto.randomUUID(),
                accountId: CONNECT_TEST_EMAIL,
                providerId: 'credential',
                userId: user.id,
                password: hashedPassword,
            },
        });

        connectUserId = user.id;
    });

    test.afterAll(async () => {
        try {
            // Keys live in their own table with no cascade from the auth user, so
            // delete them explicitly or every run leaves orphans behind.
            await prisma.$executeRawUnsafe('DELETE FROM user_api_keys WHERE "userId" = $1', connectUserId);
            await prisma.betterAuthAccount.deleteMany({ where: { user: { email: CONNECT_TEST_EMAIL } } });
            await prisma.betterAuthSession.deleteMany({ where: { user: { email: CONNECT_TEST_EMAIL } } });
            await prisma.betterAuthUser.deleteMany({ where: { email: CONNECT_TEST_EMAIL } });
        } catch (e) {
            console.warn('[MCP Connect] cleanup failed:', e);
        }
        await prisma.$disconnect();
        await pool.end();
    });

    /** A dev build can be showing the unverified-plugin prompt, which swallows clicks. */
    async function dismissPluginPrompt(page: Page) {
        const denyAll = page.getByTestId('deny-all-plugins');
        if (await denyAll.isVisible().catch(() => false)) {
            await denyAll.click();
        }
    }

    async function signInOnLoopback(page: Page) {
        await page.goto(`${LOOPBACK_ORIGIN}/login`);
        await page.fill('#email', CONNECT_TEST_EMAIL);
        await page.fill('#password', CONNECT_TEST_PASSWORD);
        await page.click('button[type="submit"]');
        // Match the signed-in page itself: a bare origin regex would also match /login.
        await page.waitForURL(url => url.hostname === '127.0.0.1' && url.port === '3001' && url.pathname === '/', { timeout: 30000 });
        await expect(page.locator('[data-testid="app-ready"]')).toBeVisible({ timeout: 30000 });
        await dismissPluginPrompt(page);
    }

    /** Reads the mcpServers block the panel hands the user, exactly as a human would copy it. */
    async function readConnectBlock(page: Page): Promise<string | null> {
        const field = page.getByTestId('mcp-connect-block');
        if ((await field.count()) === 0) return null;
        return field.inputValue();
    }

    async function openKeysPanel(page: Page) {
        await page.getByTestId('open-api-keys').click();
        await expect(page.getByTestId('api-keys-section')).toBeVisible({ timeout: 15000 });
    }

    async function mcpCall(page: Page, token: string, tool: string, args: Record<string, unknown> = {}) {
        const response = await page.request.post(`${LOOPBACK_ORIGIN}/api/mcp`, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json, text/event-stream',
                Authorization: `Bearer ${token}`,
            },
            data: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } },
        });
        const body = await response.text();
        const dataLine = body.split(/\r?\n/).filter(line => line.startsWith('data:')).pop();
        let text: string | undefined;
        if (dataLine) {
            try { text = JSON.parse(dataLine.replace(/^data:\s*/, ''))?.result?.content?.[0]?.text; } catch { text = undefined; }
        }
        return { status: response.status(), text: text ?? body };
    }

    /** Shape-tolerant: finds the first nested {lat, lon} pair so a context-shape change cannot silently pass. */
    function findCameraLatLon(node: unknown): { lat: number; lon: number } | null {
        if (!node || typeof node !== 'object') return null;
        const record = node as Record<string, unknown>;
        if (typeof record.lat === 'number' && typeof record.lon === 'number') {
            return { lat: record.lat, lon: record.lon };
        }
        for (const value of Object.values(record)) {
            const found = findCameraLatLon(value);
            if (found) return found;
        }
        return null;
    }

    test('a user can sign in on the loopback origin', async ({ page }) => {
        await signInOnLoopback(page);
        expect(page.url().startsWith(LOOPBACK_ORIGIN)).toBe(true);
    });

    test('the panel advertises this instance, and its key drives the globe', async ({ page }) => {
        await signInOnLoopback(page);
        await openKeysPanel(page);

        await page.getByTestId('api-key-name').fill('e2e-connect-flow');
        await page.getByTestId('api-key-generate').click();

        // The block is copyable before a key exists, holding a wwv_<prefix>.<secret>
        // placeholder, so wait for the panel to fill in the key it just issued.
        await expect(page.getByTestId('api-key-reveal')).toBeVisible({ timeout: 15000 });
        let block = '';
        await expect
            .poll(async () => {
                block = (await readConnectBlock(page)) ?? '';
                return /Bearer\s+wwv_[A-Za-z0-9_-]{8}\.[A-Za-z0-9_-]{43}\b/.test(block);
            }, { message: 'the panel must fill the copyable config with the key it issued', timeout: 15000 })
            .toBe(true);

        const config = JSON.parse(block) as {
            mcpServers: Record<string, { url: string; headers: { Authorization: string } }>;
        };
        const server = config.mcpServers.worldwideview;

        // The regression this file exists for: a host we do not own must never appear here.
        expect(server, 'the block must declare the worldwideview server').toBeTruthy();
        expect(block).not.toContain('worldmonitor');
        expect(server.url).toBe(`${LOOPBACK_ORIGIN}/api/mcp`);
        // The manual endpoint field must agree with the JSON block (CONNECT-01).
        await expect(page.getByTestId('mcp-endpoint')).toHaveValue(`${LOOPBACK_ORIGIN}/api/mcp`);

        issuedToken = server.headers.Authorization.replace(/^Bearer\s+/, '');
        // The real key, not the placeholder the panel shows before one exists.
        expect(issuedToken, 'the panel must hand over the real key').toMatch(/^wwv_[A-Za-z0-9_-]{8}\.[A-Za-z0-9_-]{43}$/);

        // Showing a key is not proof it was stored, and the panel fills this block
        // asynchronously, so wait for the row the token hashes into to exist.
        const prefix = issuedToken.split('.')[0];
        await expect
            .poll(async () => {
                const rows = await prisma.$queryRawUnsafe<{ prefix: string }[]>(
                    'SELECT prefix FROM user_api_keys WHERE "userId" = $1', connectUserId);
                return rows.map(row => row.prefix);
            }, { message: 'the key the panel issued must be persisted for this user', timeout: 15000 })
            .toContain(prefix);

        const before = await mcpCall(page, issuedToken, 'get_globe_context');
        expect(before.status, `MCP rejected the panel's own key: ${before.text}`).toBe(200);

        // The tab registers its globe session asynchronously through Redis, so wait for
        // the registry to show it rather than guessing at a fixed delay.
        let context = JSON.parse(before.text) as { sessionCount?: number };
        await expect
            .poll(async () => {
                const latest = await mcpCall(page, issuedToken, 'get_globe_context');
                context = JSON.parse(latest.text) as { sessionCount?: number };
                return context.sessionCount ?? 0;
            }, { message: 'the context must show the signed-in tab attached', timeout: 20000 })
            .toBeGreaterThan(0);
        expect(findCameraLatLon(context), 'the context must report a camera position').not.toBeNull();

        // alt is a framing altitude: the globe parks the camera roughly
        // 2*alt + 20km away from the target, so 5 km frames Tokyo closely.
        const pan = await mcpCall(page, issuedToken, 'pan_globe', { lat: 35.68, lon: 139.69, alt: 5000 });
        expect(pan.status, `pan_globe failed: ${pan.text}`).toBe(200);

        // The open tab consumes the queued command and animates the camera, so wait
        // for the flight to settle instead of guessing how long it takes.
        await expect
            .poll(async () => {
                const latest = await mcpCall(page, issuedToken, 'get_globe_context');
                const camera = findCameraLatLon(JSON.parse(latest.text));
                if (!camera) return Number.POSITIVE_INFINITY;
                return Math.max(Math.abs(camera.lat - 35.68), Math.abs(camera.lon - 139.69));
            }, {
                message: 'the globe camera must fly to the position the agent asked for',
                timeout: 45000,
                intervals: [1000, 2000, 3000],
            })
            .toBeLessThan(1.5);
    });

    test('a revoked key is refused', async ({ page }) => {
        test.skip(!issuedToken, 'the previous step did not reveal a token');
        await signInOnLoopback(page);
        await openKeysPanel(page);

        await page.getByTestId('api-key-revoke').first().click();
        await page.getByTestId('api-key-revoke-confirm').click();

        // A revoke is a hard delete and MCP auth reads that row live, so wait for the
        // row to go: a row that outlives the revoke is how a "revoked" key keeps working.
        await expect
            .poll(async () => {
                const rows = await prisma.$queryRawUnsafe<{ prefix: string }[]>(
                    'SELECT prefix FROM user_api_keys WHERE "userId" = $1', connectUserId);
                return rows.length;
            }, { message: 'revoking a key must delete its row', timeout: 20000 })
            .toBe(0);

        await expect
            .poll(async () => (await mcpCall(page, issuedToken as string, 'get_globe_context')).status, {
                message: 'a revoked key must be refused',
                timeout: 20000,
            })
            .toBe(401);
    });
});

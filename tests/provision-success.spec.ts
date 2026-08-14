import { test, expect } from '@playwright/test';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import crypto from 'node:crypto';

const CROSS_SERVICE_SECRET = 'test-cross-service-secret-for-e2e';

function signRequest(method: string, path: string, body?: Record<string, unknown>): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();
  const bodyStr = body !== undefined ? JSON.stringify(body) : '';
  const bodyHash = crypto.createHash('sha256').update(bodyStr, 'utf8').digest('hex');
  const canon = `${method}\n${path}\n${timestamp}\n${bodyHash}`;
  const sig = crypto.createHmac('sha256', CROSS_SERVICE_SECRET).update(canon, 'utf8').digest('hex');
  return `t=${timestamp},n=${nonce},sig=${sig}`;
}

test.describe('Provision API success path', () => {
  test.describe.configure({ mode: 'serial' });

  const PROVISION_EMAIL = `provision-e2e-${Date.now()}@test.local`;
  const PROVISION_NAME = 'Provision E2E User';

  let prisma: PrismaClient;
  let pool: Pool;

  async function cleanupProvisionUser(email: string): Promise<void> {
    const user = await prisma.betterAuthUser.findUnique({ where: { email } });
    if (!user) return;
    await prisma.setupToken.deleteMany({ where: { userId: user.id } });
    const memberships = await prisma.pluginMember.findMany({
      where: { userId: user.id },
      select: { organizationId: true },
    });
    await prisma.pluginMember.deleteMany({ where: { userId: user.id } });
    await prisma.pluginOrganization.deleteMany({
      where: { id: { in: memberships.map((m) => m.organizationId) } },
    });
    await prisma.betterAuthAccount.deleteMany({ where: { userId: user.id } });
    await prisma.betterAuthUser.deleteMany({ where: { id: user.id } });
  }

  test.beforeAll(async () => {
    process.env.CROSS_SERVICE_SECRET = CROSS_SERVICE_SECRET;

    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@127.0.0.1:5432/worldwideview?schema=public',
    });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    await cleanupProvisionUser(PROVISION_EMAIL);
  });

  test.afterAll(async () => {
    await cleanupProvisionUser(PROVISION_EMAIL);
    await prisma.$disconnect();
    await pool.end();
  });

  test('HMAC-signed provision creates user, owner membership, and setup token', async ({ page }) => {
    const body = {
      email: PROVISION_EMAIL,
      name: PROVISION_NAME,
      hubUserId: `hub-${Date.now()}`,
    };
    const sigHeader = signRequest('POST', '/api/provision', body);

    const response = await page.request.post('/api/provision', {
      data: body,
      headers: { 'X-Service-Signature': sigHeader },
    });

    if (response.status() !== 200) {
      const errBody = await response.text();
      console.error(`[provision-success] FAIL: status=${response.status()}, body=${errBody}`);
    }
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(typeof data.setupToken).toBe('string');
    expect(data.setupToken.length).toBeGreaterThan(0);
    expect(data.setupUrl).toContain(`/setup?token=${data.setupToken}`);

    // DB assertions — exactly what the route creates (user + credential account + org + owner member + setup token).
    const user = await prisma.betterAuthUser.findUnique({ where: { email: PROVISION_EMAIL } });
    expect(user).not.toBeNull();
    expect(user!.name).toBe(PROVISION_NAME);
    expect(user!.emailVerified).toBe(false);
    expect(user!.role).toBe('user');

    const account = await prisma.betterAuthAccount.findFirst({
      where: { userId: user!.id, providerId: 'credential', accountId: PROVISION_EMAIL },
    });
    expect(account).not.toBeNull();
    expect(account!.password).toBeTruthy();

    const membership = await prisma.pluginMember.findFirst({
      where: { userId: user!.id, role: 'owner' },
    });
    expect(membership).not.toBeNull();

    const org = await prisma.pluginOrganization.findUnique({
      where: { id: membership!.organizationId },
    });
    expect(org).not.toBeNull();
    expect(org!.name).toBe(`${PROVISION_NAME}'s Workspace`);

    const tokenRecord = await prisma.setupToken.findFirst({
      where: { userId: user!.id, organizationId: org!.id },
    });
    expect(tokenRecord).not.toBeNull();
    const expectedHash = crypto
      .createHash('sha256')
      .update(data.setupToken, 'utf8')
      .digest('hex');
    expect(tokenRecord!.tokenHash).toBe(expectedHash);
    expect(tokenRecord!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test('provision for an already-provisioned user regenerates a fresh token without new rows', async ({ page }) => {
    const user = await prisma.betterAuthUser.findUnique({ where: { email: PROVISION_EMAIL } });
    expect(user).not.toBeNull();

    const tokensBefore = await prisma.setupToken.count({ where: { userId: user!.id } });
    const membersBefore = await prisma.pluginMember.count({ where: { userId: user!.id } });
    const orgsBefore = await prisma.pluginOrganization.count();

    // Uppercase email exercises the route's trim().toLowerCase() — still resolves the existing user.
    const body = {
      email: PROVISION_EMAIL.toUpperCase(),
      name: 'Provision E2E User Renamed',
      hubUserId: `hub-renamed-${Date.now()}`,
    };
    const sigHeader = signRequest('POST', '/api/provision', body);

    const response = await page.request.post('/api/provision', {
      data: body,
      headers: { 'X-Service-Signature': sigHeader },
    });

    if (response.status() !== 200) {
      const errBody = await response.text();
      console.error(`[provision-success] Idempotent FAIL: status=${response.status()}, body=${errBody}`);
    }
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(typeof data.setupToken).toBe('string');
    expect(data.setupToken.length).toBeGreaterThan(0);

    // No duplicate user, membership, or org — only a fresh setup token.
    expect(await prisma.betterAuthUser.count({ where: { email: PROVISION_EMAIL } })).toBe(1);
    expect(await prisma.pluginMember.count({ where: { userId: user!.id } })).toBe(membersBefore);
    expect(await prisma.pluginOrganization.count()).toBe(orgsBefore);
    expect(await prisma.setupToken.count({ where: { userId: user!.id } })).toBe(tokensBefore + 1);

    const latestToken = await prisma.setupToken.findFirst({
      where: { userId: user!.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(latestToken).not.toBeNull();
    const expectedHash = crypto
      .createHash('sha256')
      .update(data.setupToken, 'utf8')
      .digest('hex');
    expect(latestToken!.tokenHash).toBe(expectedHash);

    // Every token is unique — a fresh token is generated per request.
    const hashes = await prisma.setupToken.findMany({
      where: { userId: user!.id },
      select: { tokenHash: true },
    });
    expect(new Set(hashes.map((t) => t.tokenHash)).size).toBe(hashes.length);
  });

  test('HMAC-signed provision with missing required fields returns 400', async ({ page }) => {
    const body = { email: `missing-fields-${Date.now()}@test.local` };
    const sigHeader = signRequest('POST', '/api/provision', body);

    const response = await page.request.post('/api/provision', {
      data: body,
      headers: { 'X-Service-Signature': sigHeader },
    });

    expect(response.status()).toBe(400);
  });
});

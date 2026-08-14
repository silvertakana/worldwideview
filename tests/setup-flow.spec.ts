import { test, expect } from '@playwright/test';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hashPassword } from 'better-auth/crypto';
import crypto from 'node:crypto';

const SETUP_TEST_EMAIL = 'setup-e2e-test@test.local';
const SETUP_TEST_PASSWORD = 'SetupTestPassword123!';

test.describe('Setup Flow', () => {
  test.describe.configure({ mode: 'serial' });

  let prisma: PrismaClient;
  let pool: Pool;

  test.beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/worldwideview?schema=public" });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    await prisma.betterAuthUser.deleteMany({
      where: { email: SETUP_TEST_EMAIL },
    });
    await prisma.betterAuthAccount.deleteMany({
      where: { accountId: SETUP_TEST_EMAIL },
    });
  });

  test.afterAll(async () => {
    await prisma.betterAuthUser.deleteMany({
      where: { email: SETUP_TEST_EMAIL },
    });
    await prisma.betterAuthAccount.deleteMany({
      where: { accountId: SETUP_TEST_EMAIL },
    });
    await prisma.$disconnect();
    await pool.end();
  });

  test('local mode shows admin creation form', async ({ page }) => {
    test.skip(!!process.env.CI, 'Requires clean DB with no users');
    await page.goto('/setup');

    await expect(page.locator('h1')).toContainText('Welcome');
    await expect(page.locator('input#name')).toBeVisible();
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.locator('input#confirm')).toBeVisible();
  });

  test('cloud mode with valid token shows activation form', async ({ page }) => {
    const tokenEmail = `setup-token-${Date.now()}@test.local`;
    const userId = crypto.randomUUID();

    try {
      await prisma.betterAuthUser.create({
        data: {
          id: userId,
          email: tokenEmail,
          name: 'Setup Token Test',
          emailVerified: false,
          role: 'user',
        },
      });

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');

      await prisma.setupToken.create({
        data: {
          tokenHash,
          userId,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      await page.goto(`/setup?token=${rawToken}`);

      await expect(page.locator('h1')).toContainText('Activate Your Account');
      const emailInput = page.locator('input#email');
      await expect(emailInput).toHaveValue(tokenEmail);
      await expect(page.locator('input#name')).toBeVisible();
      await expect(page.locator('input#password')).toBeVisible();
      await expect(page.locator('input#confirm')).toBeVisible();
    } finally {
      await prisma.setupToken.deleteMany({ where: { userId } });
      await prisma.betterAuthUser.deleteMany({ where: { id: userId } });
    }
  });

  test('cloud mode with invalid token shows error', async ({ page }) => {
    await page.goto('/setup?token=invalid-token-value');

    await expect(page.locator('h1')).toContainText('Invalid Setup Link');
    await expect(page.locator('p')).toContainText('Invalid or expired setup link');
  });

  test('cloud activation - full flow', async ({ page }) => {
    const activateEmail = `activate-${Date.now()}@test.local`;
    const userId = crypto.randomUUID();
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');

    try {
      await prisma.betterAuthUser.create({
        data: {
          id: userId,
          email: activateEmail,
          name: 'Activate Test',
          emailVerified: false,
          role: 'user',
        },
      });

      await prisma.betterAuthAccount.create({
        data: {
          id: crypto.randomUUID(),
          accountId: activateEmail,
          providerId: 'credential',
          userId,
          password: await hashPassword(crypto.randomBytes(32).toString('hex')),
        },
      });

      await prisma.setupToken.create({
        data: {
          tokenHash,
          userId,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      await page.goto(`/setup?token=${rawToken}`);
      await expect(page.locator('h1')).toContainText('Activate Your Account');

      await page.fill('input#name', 'Activated User');
      await page.fill('input#password', SETUP_TEST_PASSWORD);
      await page.fill('input#confirm', SETUP_TEST_PASSWORD);
      await page.click('button[type="submit"]');

      await page.waitForURL('/login', { timeout: 15000 });

      await page.fill('input#email', activateEmail);
      await page.fill('input#password', SETUP_TEST_PASSWORD);
      await page.click('button[type="submit"]');

      // Wait for redirect to home after login
      await page.waitForURL('/', { timeout: 30000 });
      await expect(page.locator('[data-testid="app-ready"]')).toBeVisible({ timeout: 30000 });
    } finally {
      await prisma.setupToken.deleteMany({ where: { userId } });
      await prisma.betterAuthAccount.deleteMany({ where: { userId } });
      await prisma.betterAuthUser.deleteMany({ where: { id: userId } });
    }
  });

  test('provision endpoint rejects request without HMAC signature', async ({ page }) => {
    const response = await page.request.post('/api/provision', {
      data: { email: 'test@test.local', name: 'Test', hubUserId: 'hub-1' },
    });
    expect(response.status()).toBe(401);
  });

  test('provision endpoint rejects request with invalid HMAC', async ({ page }) => {
    const response = await page.request.post('/api/provision', {
      data: { email: 'test@test.local', name: 'Test', hubUserId: 'hub-1' },
      headers: { 'X-Service-Signature': 't=0,n=invalid,sig=0000' },
    });
    expect(response.status()).toBe(401);
  });
});

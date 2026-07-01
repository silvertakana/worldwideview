import { test, expect } from '@playwright/test';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hashPassword } from 'better-auth/crypto';
import crypto from 'crypto';

const LOGIN_TEST_EMAIL = 'login-e2e-test@test.local';
const LOGIN_TEST_PASSWORD = 'LoginTestPassword123!';

test.describe('Login Flow', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ storageState: { cookies: [], origins: [] } });

  let prisma: PrismaClient;
  let pool: Pool;

  test.beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/worldwideview?schema=public" });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    const hashedPassword = await hashPassword(LOGIN_TEST_PASSWORD);
    const userId = crypto.randomUUID();

    const user = await prisma.betterAuthUser.upsert({
      where: { email: LOGIN_TEST_EMAIL },
      update: { name: 'Login E2E Test' },
      create: {
        id: userId,
        email: LOGIN_TEST_EMAIL,
        name: 'Login E2E Test',
        emailVerified: true,
        role: 'user',
      },
    });

    await prisma.betterAuthAccount.deleteMany({
      where: { userId: user.id },
    });
    await prisma.betterAuthAccount.create({
      data: {
        id: crypto.randomUUID(),
        accountId: LOGIN_TEST_EMAIL,
        providerId: 'credential',
        userId: user.id,
        password: hashedPassword,
      },
    });
  });

  test('sign in with valid credentials redirects to home', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.fill('#email', LOGIN_TEST_EMAIL);
    await page.fill('#password', LOGIN_TEST_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL('/', { timeout: 30000 });
    await expect(page.locator('[data-testid="app-ready"]')).toBeVisible({ timeout: 30000 });
  });

  test('session persists on hard refresh', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.fill('#email', LOGIN_TEST_EMAIL);
    await page.fill('#password', LOGIN_TEST_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL('/', { timeout: 30000 });
    await expect(page.locator('[data-testid="app-ready"]')).toBeVisible({ timeout: 30000 });

    await page.reload();
    await page.waitForLoadState('networkidle');

    expect(page.url()).not.toContain('/login');
    await expect(page.locator('[data-testid="app-ready"]')).toBeVisible({ timeout: 30000 });
  });

  test.afterAll(async () => {
    try {
      await prisma.betterAuthAccount.deleteMany({
        where: { user: { email: LOGIN_TEST_EMAIL } }
      });
      await prisma.betterAuthSession.deleteMany({
        where: { user: { email: LOGIN_TEST_EMAIL } }
      });
      await prisma.betterAuthUser.deleteMany({
        where: { email: LOGIN_TEST_EMAIL }
      });
    } catch (e) {
      console.warn('[Login Test] Cleanup after all failed:', e);
    }
    await prisma.$disconnect();
    await pool.end();
  });
});

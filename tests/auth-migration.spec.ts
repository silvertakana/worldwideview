import { test, expect } from '@playwright/test';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const LEGACY_MIGRATION_EMAIL = 'legacy-migration-test@test.local';
const LEGACY_MIGRATION_PASSWORD = 'MigrationTestPassword123!';

test.describe('Legacy User Migration', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ storageState: { cookies: [], origins: [] } });

  let prisma: PrismaClient;
  let pool: Pool;

  test.beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/worldwideview?schema=public" });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    await prisma.betterAuthAccount.deleteMany({
      where: { user: { email: LEGACY_MIGRATION_EMAIL } }
    });
    await prisma.betterAuthSession.deleteMany({
      where: { user: { email: LEGACY_MIGRATION_EMAIL } }
    });
    await prisma.betterAuthUser.deleteMany({
      where: { email: LEGACY_MIGRATION_EMAIL }
    });

    const hashedPassword = bcrypt.hashSync(LEGACY_MIGRATION_PASSWORD, 10);
    await prisma.user.upsert({
      where: { email: LEGACY_MIGRATION_EMAIL },
      update: { hashedPassword },
      create: {
        id: crypto.randomUUID(),
        email: LEGACY_MIGRATION_EMAIL,
        name: 'Legacy Migration Test',
        hashedPassword,
        role: 'ADMIN',
      },
    });
  });

  test('legacy user is migrated and can sign in', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.fill('#email', LEGACY_MIGRATION_EMAIL);
    await page.fill('#password', LEGACY_MIGRATION_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL('/', { timeout: 30000 });
    await expect(page.locator('[data-testid="app-ready"]')).toBeVisible({ timeout: 30000 });

    const migratedUser = await prisma.betterAuthUser.findUnique({
      where: { email: LEGACY_MIGRATION_EMAIL }
    });
    expect(migratedUser).not.toBeNull();
    expect(migratedUser!.email).toBe(LEGACY_MIGRATION_EMAIL);

    const migratedAccount = await prisma.betterAuthAccount.findFirst({
      where: { accountId: LEGACY_MIGRATION_EMAIL }
    });
    expect(migratedAccount).not.toBeNull();
  });

  test('migration is idempotent - second login does not create duplicate', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.fill('#email', LEGACY_MIGRATION_EMAIL);
    await page.fill('#password', LEGACY_MIGRATION_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL('/', { timeout: 30000 });
    await expect(page.locator('[data-testid="app-ready"]')).toBeVisible({ timeout: 30000 });

    const users = await prisma.betterAuthUser.findMany({
      where: { email: LEGACY_MIGRATION_EMAIL }
    });
    expect(users.length).toBe(1);

    const accounts = await prisma.betterAuthAccount.findMany({
      where: { accountId: LEGACY_MIGRATION_EMAIL }
    });
    expect(accounts.length).toBe(1);
  });

  test.afterAll(async () => {
    try {
      await prisma.betterAuthAccount.deleteMany({
        where: { user: { email: LEGACY_MIGRATION_EMAIL } }
      });
      await prisma.betterAuthSession.deleteMany({
        where: { user: { email: LEGACY_MIGRATION_EMAIL } }
      });
      await prisma.betterAuthUser.deleteMany({
        where: { email: LEGACY_MIGRATION_EMAIL }
      });
      await prisma.user.deleteMany({
        where: { email: LEGACY_MIGRATION_EMAIL }
      });
    } catch (e) {
      console.warn('[Migration Test] Cleanup after all failed:', e);
    }
    await prisma.$disconnect();
    await pool.end();
  });
});

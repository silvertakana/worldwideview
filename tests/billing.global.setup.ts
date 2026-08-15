/* eslint-disable no-console */
import { chromium, type FullConfig } from '@playwright/test';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from 'better-auth/crypto';
import fs from 'fs';
import path from 'path';

export const TEST_EMAIL = 'billing-e2e@worldwideview.local';
export const TEST_PASSWORD = 'BillingE2E-2026!!';
export const TEST_ORG_SLUG = 'billing-e2e-org';
export const TEST_WORKSPACE_SUBDOMAIN = 'billing-e2e-ws';

const HUB_ENV_DIR = path.resolve(process.cwd(), '..', 'worldwideview-web.fix-billing', '.env.local');

function loadSingleEnv(envPath: string) {
  try {
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = (match[2] || '').trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        if (value) process.env[key] = value;
      }
    });
  } catch {
    // Ignore read errors
  }
}

function loadEnv() {
  loadSingleEnv(path.resolve(process.cwd(), '.env'));
  loadSingleEnv(HUB_ENV_DIR);
}

async function deleteSupabaseUser(email: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return;
  const base = supabaseUrl.replace(/\/$/, '');
  try {
    const listRes = await fetch(`${base}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    if (listRes.ok) {
      const list = await listRes.json();
      for (const user of list.users || []) {
        if (user.email === email) {
          await fetch(`${base}/auth/v1/admin/users/${user.id}`, {
            method: 'DELETE',
            headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
          });
          console.log(`[billing-setup] Deleted Supabase user ${email}`);
        }
      }
    }
  } catch (e) {
    console.log(`[billing-setup] Supabase cleanup error: ${e}`);
  }
}

async function createSupabaseUser(email: string, password: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('[billing-setup] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from hub .env.local');
  }
  const base = supabaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: 'Billing E2E Tester' },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (!(res.status === 409 || body.includes('already exists') || body.includes('already registered'))) {
      throw new Error(`[billing-setup] Supabase admin create user failed (${res.status}): ${body}`);
    }
  }
  console.log(`[billing-setup] Supabase user ensured: ${email}`);
}

async function seedGlobeDb() {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/worldwideview?schema=public',
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    for (let i = 0; i < 5; i++) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        break;
      } catch {
        console.log(`[billing-setup] Waiting for database (attempt ${i + 1}/5)...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Defensive cleanup of prior runs (respect FK order).
    const priorUser = await prisma.betterAuthUser.findUnique({ where: { email: TEST_EMAIL } });
    const priorOrg = priorUser
      ? await prisma.pluginMember.findFirst({ where: { userId: priorUser.id } })
      : null;
    if (priorOrg) {
      await prisma.workspace.deleteMany({ where: { ownerId: priorUser!.id } });
      await prisma.orgTier.deleteMany({ where: { organizationId: priorOrg.organizationId } });
      await prisma.pluginMember.deleteMany({ where: { organizationId: priorOrg.organizationId } });
      await prisma.pluginOrganization.deleteMany({ where: { id: priorOrg.organizationId } });
    }
    await prisma.betterAuthSession.deleteMany({ where: { user: { email: TEST_EMAIL } } });
    await prisma.betterAuthAccount.deleteMany({ where: { user: { email: TEST_EMAIL } } });
    await prisma.betterAuthUser.deleteMany({ where: { email: TEST_EMAIL } });

    const hashedPassword = await hashPassword(TEST_PASSWORD);
    const user = await prisma.betterAuthUser.create({
      data: {
        email: TEST_EMAIL,
        name: 'Billing E2E Tester',
        emailVerified: true,
        role: 'ADMIN',
      },
    });
    await prisma.betterAuthAccount.create({
      data: {
        userId: user.id,
        providerId: 'credential',
        accountId: TEST_EMAIL,
        password: hashedPassword,
      },
    });

    const org = await prisma.pluginOrganization.create({
      data: { name: 'Billing E2E Org', slug: TEST_ORG_SLUG },
    });
    // role MUST be "owner" — setOrgTier() only locks workspaces owned by org
    // members with role "owner".
    await prisma.pluginMember.create({
      data: { organizationId: org.id, userId: user.id, role: 'owner' },
    });
    await prisma.workspace.create({
      data: {
        name: 'Billing E2E Workspace',
        subdomain: TEST_WORKSPACE_SUBDOMAIN,
        ownerId: user.id,
        status: 'trialing',
        plan: 'basic',
        tier: 'free',
        locked: false,
      },
    });
    await prisma.orgTier.create({
      data: { organizationId: org.id, tier: 'free', status: 'active' },
    });

    console.log(`[billing-setup] Globe seeded: user ${TEST_EMAIL}, org ${org.id.slice(0, 8)}, workspace, org_tier=free`);
    return user.id;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function loginToHubAndSaveStorage(baseURL: string, storageState: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${baseURL}/login`, { timeout: 30000 });
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    try {
      // Pathname-based check — a regex on the full URL would falsely match
      // "//hub" inside the host "hub.wwv.local" and resolve before the
      // session cookie is committed.
      await page.waitForURL(
        (url) =>
          url.pathname.startsWith('/pricing') ||
          url.pathname.startsWith('/accounts') ||
          url.pathname.startsWith('/hub'),
        { timeout: 25000 },
      );
      await page.waitForTimeout(1500); // let the session cookie settle
    } catch {
      const url = page.url();
      const errorText = await page.getByText(/invalid|credential|error/i).first().textContent().catch(() => '');
      throw new Error(
        `[billing-setup] UI login failed. Final URL: ${url}${errorText ? ` | page error: ${errorText}` : ''}`,
      );
    }
    console.log(`[billing-setup] UI login ok, landed at ${new URL(page.url()).pathname}`);
  } finally {
    const dir = path.dirname(storageState);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await page.context().storageState({ path: storageState });
    console.log(`[billing-setup] Storage state saved: ${storageState}`);
    await browser.close();
  }
}

async function globalSetup(config: FullConfig) {
  loadEnv();
  const storageState = config.projects[0].use.storageState;
  const baseURL = config.projects[0].use.baseURL;
  if (typeof storageState !== 'string' || !baseURL) {
    throw new Error('[billing-setup] storageState / baseURL not defined in config');
  }

  await deleteSupabaseUser(TEST_EMAIL);
  await seedGlobeDb();
  await createSupabaseUser(TEST_EMAIL, TEST_PASSWORD);
  await loginToHubAndSaveStorage(baseURL, storageState);
  console.log('[billing-setup] Global setup complete.');
}

export default globalSetup;

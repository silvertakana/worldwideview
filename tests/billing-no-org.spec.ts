/* eslint-disable no-console */
import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { spawnSync } from 'node:child_process';
import fs from 'fs';
import path from 'path';

/**
 * Regression test for the stopgap billing fix (hub worktree
 * worldwideview-web.fix-billing):
 *
 *   Scenario: a hub user who has NO globe-side org (never provisioned there)
 *   pays with the 4242 test card. The webhook fires and the tier-sync 404s
 *   because the globe has no org for the user. The hub must:
 *     1. log the REAL sync outcome (failure), NOT a false "Tier synced"
 *     2. still render Pro on the billing page via the hub-authoritative
 *        fallback (Stripe subscription), so the paid user sees Pro even
 *        though the globe mirror is missing.
 *
 * Deliberately does NOT seed any globe rows for this user. The globe DB is
 * asserted to contain zero rows for the email both before and after payment.
 *
 * Requirements (externally managed, same as billing-flow.spec.ts):
 *   - hub    https://hub.wwv.local   (wwv-dev-hub container)
 *   - globe  http://localhost:3000    (wwv-dev-globe container)
 *   - `stripe listen` forwarding to https://hub.wwv.local/api/billing/webhook
 *   - `stripe` CLI default account = the app's sandbox account
 */

export const NO_ORG_EMAIL = 'billing-noorg@worldwideview.local';
const NO_ORG_PASSWORD = 'BillingNoOrg-2026!!';
const HUB_CONTAINER = 'wwv-dev-hub';

// ---------------------------------------------------------------------------
// Env loading (worker processes do NOT inherit env set in globalSetup).
// ---------------------------------------------------------------------------
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
loadSingleEnv(path.resolve(process.cwd(), '.env'));
loadSingleEnv(path.resolve(process.cwd(), '..', 'worldwideview-web.fix-billing', '.env.local'));

// ---------------------------------------------------------------------------
// Supabase admin API (same pattern as billing.global.setup.ts).
// ---------------------------------------------------------------------------
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
          console.log(`[billing-noorg] Deleted Supabase user ${email}`);
        }
      }
    }
  } catch (e) {
    console.log(`[billing-noorg] Supabase cleanup error: ${e}`);
  }
}

async function createSupabaseUser(email: string, password: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('[billing-noorg] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from hub .env.local');
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
      user_metadata: { name: 'Billing No-Org Tester' },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (!(res.status === 409 || body.includes('already exists') || body.includes('already registered'))) {
      throw new Error(`[billing-noorg] Supabase admin create user failed (${res.status}): ${body}`);
    }
  }
  console.log(`[billing-noorg] Supabase user ensured: ${email}`);
}

// ---------------------------------------------------------------------------
// Stripe REST helpers (no CLI, no interactive confirmation).
// ---------------------------------------------------------------------------
const STRIPE_BASE = 'https://api.stripe.com/v1';
function stripeHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY || ''}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

/** Best-effort: cancel any live subscription for the no-org user's customers. */
async function cancelNoOrgSubscriptions(): Promise<void> {
  try {
    const customersRes = await fetch(`${STRIPE_BASE}/customers?email=${encodeURIComponent(NO_ORG_EMAIL)}&limit=10`, {
      headers: stripeHeaders(),
    });
    const customers = await customersRes.json();
    for (const c of customers.data || []) {
      const subsRes = await fetch(`${STRIPE_BASE}/subscriptions?customer=${c.id}&limit=10`, {
        headers: stripeHeaders(),
      });
      const subs = await subsRes.json();
      for (const s of subs.data || []) {
        if (['trialing', 'active', 'past_due'].includes(s.status)) {
          await fetch(`${STRIPE_BASE}/subscriptions/${s.id}`, { method: 'DELETE', headers: stripeHeaders() });
          console.log(`[billing-noorg] Cancelled stale subscription ${s.id}`);
        }
      }
    }
  } catch (e) {
    console.log(`[billing-noorg] Stripe cleanup error: ${e}`);
  }
}

// ---------------------------------------------------------------------------
// Hosted checkout card entry (mirror of billing-flow.spec.ts).
// ---------------------------------------------------------------------------
const CARD_ENTRY_TIMEOUT_MS = 45000;

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms: ${label}`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function fillStripeCard(page: Page): Promise<void> {
  await page.getByPlaceholder('1234 1234 1234 1234').fill('4242 4242 4242 4242');
  await page.getByPlaceholder('MM / YY').fill('12/32');
  await page.getByRole('textbox', { name: 'CVC' }).fill('123');
  await page.getByPlaceholder('Full name on card').fill('Billing No-Org User');

  const country = page.getByRole('combobox', { name: 'Country or region' });
  await country.selectOption({ label: 'United States' });

  const postal = page.getByRole('textbox', { name: /postal|zip/i });
  if (await postal.count()) await postal.fill('90210');
  const addr1 = page.getByRole('textbox', { name: /address/i });
  if (await addr1.count()) await addr1.fill('1 Market Street');

  const pay = page.getByRole('button', { name: /start trial/i });
  await expect(pay).toBeVisible({ timeout: 10000 });
  await pay.click();
}

/**
 * Read the latest 2000 lines of hub container logs (`docker logs --tail 2000`).
 * No `--since` filtering: on this host (Docker Desktop Windows) `docker logs
 * --since` provably returns 0 lines, so the log window is instead diffed
 * in-process by comparing occurrence counts of the needle lines between a
 * pre-checkout snapshot and a post-poll snapshot.
 *
 * Both stdout AND stderr are merged: the docker CLI writes this container's
 * log lines (including the webhook `[webhook] Tier sync FAILED ...` lines)
 * to stderr on this host, so a stdout-only capture silently misses them.
 */
function readHubLogs(): string {
  const res = spawnSync('docker', ['logs', '--tail', '2000', HUB_CONTAINER], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return String(res.stdout || '') + String(res.stderr || '');
}

/** Count non-overlapping occurrences of `needle` inside `haystack`. */
function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------
let prisma: PrismaClient;
let pool: Pool;

test.describe.configure({ mode: 'serial', timeout: 240000 });

test.beforeAll(async () => {
  pool = new Pool({
    connectionString:
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/worldwideview?schema=public',
  });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });

  // Fresh hub user, NO globe rows, NO live Stripe subscriptions.
  await deleteSupabaseUser(NO_ORG_EMAIL);
  await cancelNoOrgSubscriptions();
  await createSupabaseUser(NO_ORG_EMAIL, NO_ORG_PASSWORD);

  const globeUser = await prisma.betterAuthUser.findUnique({ where: { email: NO_ORG_EMAIL } });
  expect(globeUser, 'no-org user must not exist in the globe DB before the test').toBeNull();
  console.log('[billing-noorg] Verified: zero globe rows for', NO_ORG_EMAIL);
});

test.afterAll(async () => {
  await deleteSupabaseUser(NO_ORG_EMAIL);
  await cancelNoOrgSubscriptions();
  if (prisma) await prisma.$disconnect();
  if (pool) await pool.end();
});

test('no-globe-org user pays with 4242 -> hub UI shows Pro via fallback; webhook logs honest sync failure', async ({ page }) => {
  // Drop the storageState session (billing-e2e) and log in as the no-org user.
  await page.context().clearCookies();
  await page.goto('/login');
  await page.fill('input[name="email"]', NO_ORG_EMAIL);
  await page.fill('input[name="password"]', NO_ORG_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(
    (url) => url.pathname.startsWith('/pricing') || url.pathname.startsWith('/accounts') || url.pathname.startsWith('/hub'),
    { timeout: 25000 },
  );

  // Before payment the fallback has nothing (no Stripe sub, no entitlement):
  // the page must show the free state.
  await page.goto('/pricing');
  const manageBillingLink = page.getByRole('link', { name: /manage billing/i });
  await expect(manageBillingLink).toBeVisible({ timeout: 20000 });
  await manageBillingLink.click();
  await page.waitForURL(/\/accounts\/billing/);

  const upgradeBtn = page.getByRole('button', { name: /upgrade to pro/i });
  await expect(upgradeBtn).toBeVisible({ timeout: 20000 });
  console.log('[billing-noorg] Pre-payment: "Upgrade to Pro" shown (fallback correctly empty)');

  // Real UI click -> hosted checkout -> 4242 card.
  const checkoutRespP = page.waitForResponse(
    (r) => r.url().includes('/api/billing/checkout') && r.request().method() === 'POST',
    { timeout: 20000 },
  );
  // Log snapshot: capture the full `--tail 2000` hub log BEFORE the checkout
  // click. The honest-logging assertion diffs this baseline against a later
  // snapshot by counting needle occurrences, so `docker logs --since` (broken
  // on this host) is never used.
  const logsBefore = readHubLogs();
  await upgradeBtn.click();
  const resp = await checkoutRespP;
  expect(resp.status(), 'real "Upgrade to Pro" click must reach Stripe (200)').toBe(200);
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 });
  await withTimeout(fillStripeCard(page), CARD_ENTRY_TIMEOUT_MS, 'fillStripeCard');
  await page.waitForURL(/status=success|accounts\/billing/, { timeout: 45000 });
  console.log('[billing-noorg] Payment completed (4242)');

  // THE FALLBACK ASSERTION: the billing page must show Pro ("Manage Billing")
  // even though the globe has no org for this user. "Upgrade to Pro" must be gone.
  await expect(page.getByRole('button', { name: /manage billing/i })).toBeVisible({ timeout: 45000 });
  await expect(page.getByRole('button', { name: /upgrade to pro/i })).toHaveCount(0, { timeout: 10000 });
  console.log('[billing-noorg] Hub UI shows Pro via hub-authoritative fallback');

  // The globe DB must STILL have zero rows for the user: the sync wrote nothing.
  const globeUser = await prisma.betterAuthUser.findUnique({ where: { email: NO_ORG_EMAIL } });
  expect(globeUser, 'no-org user must not exist in the globe DB after payment').toBeNull();
  console.log('[billing-noorg] Verified: globe still has zero rows (nothing silently written)');

  // THE HONEST-LOGGING ASSERTION: the webhook must have logged the REAL sync
  // outcome (failure), not the false "Tier synced" success line. Diff by
  // counting needle occurrences in the pre-checkout baseline vs the polled
  // snapshot (no `--since`; it returns 0 lines on this host).
  const failNeedle = `Tier sync FAILED for ${NO_ORG_EMAIL}`;
  const syncNeedle = `Tier synced for ${NO_ORG_EMAIL}`;
  const failBefore = countOccurrences(logsBefore, failNeedle);
  await expect
    .poll(async () => countOccurrences(readHubLogs(), failNeedle), { timeout: 45000, intervals: [2000] })
    .toBeGreaterThan(failBefore);
  const logsAfter = readHubLogs();
  expect(
    countOccurrences(logsAfter, syncNeedle),
    `webhook must NOT log a false "Tier synced" for ${NO_ORG_EMAIL} when the globe 404s`,
  ).toBe(countOccurrences(logsBefore, syncNeedle));
  console.log('[billing-noorg] Webhook logged honest sync failure (no false "Tier synced")');
});

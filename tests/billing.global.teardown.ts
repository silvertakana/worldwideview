/* eslint-disable no-console */
import { PrismaClient } from '../src/generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

export const TEST_EMAIL = 'billing-e2e@worldwideview.local';
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
          console.log(`[billing-teardown] Deleted Supabase user ${email}`);
        }
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

async function globalTeardown() {
  loadEnv();
  await deleteSupabaseUser(TEST_EMAIL);

  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/worldwideview?schema=public',
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const user = await prisma.betterAuthUser.findUnique({ where: { email: TEST_EMAIL } });
    if (user) {
      await prisma.workspace.deleteMany({ where: { ownerId: user.id } });
      const memberships = await prisma.pluginMember.findMany({ where: { userId: user.id } });
      for (const m of memberships) {
        await prisma.orgTier.deleteMany({ where: { organizationId: m.organizationId } });
        await prisma.pluginMember.deleteMany({ where: { organizationId: m.organizationId } });
        await prisma.pluginOrganization.deleteMany({ where: { id: m.organizationId } });
      }
    }
    await prisma.betterAuthSession.deleteMany({ where: { user: { email: TEST_EMAIL } } });
    await prisma.betterAuthAccount.deleteMany({ where: { user: { email: TEST_EMAIL } } });
    await prisma.betterAuthUser.deleteMany({ where: { email: TEST_EMAIL } });
    console.log(`[billing-teardown] Globe test rows purged for ${TEST_EMAIL}`);
  } catch (e) {
    console.error(`[billing-teardown] Prisma cleanup error:`, e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

export default globalTeardown;

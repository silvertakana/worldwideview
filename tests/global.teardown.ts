/* eslint-disable no-console */
import { type FullConfig } from '@playwright/test';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import fs from 'fs';
import path from 'path';

export const TEST_USER_EMAIL = 'playwright-test@worldwideview.local';

function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
          if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
          if (value) process.env[key] = value;
        }
      });
    }
  } catch {
    // Ignore read errors
  }
}

async function globalTeardown() {
  loadEnv();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/worldwideview?schema=public" });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  console.log(`[Teardown] Cleaning up test user: ${TEST_USER_EMAIL}`);
  try {
      console.log(`[Teardown] Cleaning up alert mock rule + events...`);
      await prisma.alertEvent.deleteMany({
          where: { pluginId: 'e2e-alert-mock' }
      });
      await prisma.alertRule.deleteMany({
          where: { pluginId: 'e2e-alert-mock' }
      });
      console.log(`[Teardown] Cleaning up mock plugin...`);
      await prisma.installedPlugin.deleteMany({
          where: { pluginId: 'e2e-alert-mock' }
      });
      await prisma.installedPlugin.deleteMany({
          where: { pluginId: 'e2e-mock-plugin' }
      });
      await prisma.betterAuthUser.deleteMany({
        where: { email: TEST_USER_EMAIL },
      });
      // Remove the staged local-registry manifest directory (only the subdir
      // global.setup created — never the whole public/plugins-local tree).
      const pluginsLocal = path.join(process.cwd(), 'public', 'plugins-local', 'e2e-alert-mock');
      if (fs.existsSync(pluginsLocal)) {
        fs.rmSync(pluginsLocal, { recursive: true, force: true });
      }
  } catch {
      console.error(`[Teardown] Failed to delete test user:`, e);
  } finally {
      await prisma.$disconnect();
      await pool.end();
  }
}

export default globalTeardown;

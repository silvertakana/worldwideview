import { chromium, type FullConfig } from '@playwright/test';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
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
          process.env[key] = value;
        }
      });
    }
  } catch (e) {
    // Ignore read errors
  }
}

async function globalSetup(config: FullConfig) {
  loadEnv();
  const { storageState, baseURL } = config.projects[0].use;
  
  if (!baseURL) {
    throw new Error('baseURL is not defined in Playwright config');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/worldwideview?schema=public" });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Retry/poll mechanism for database connectivity
    let dbConnected = false;
    for (let i = 0; i < 5; i++) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        dbConnected = true;
        break;
      } catch (e) {
        console.log(`[Setup] Waiting for database (attempt ${i + 1}/5)...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!dbConnected) {
      throw new Error('[Setup] Could not connect to database after 5 attempts.');
    }

    // 2. Generate a secure random password and hash it
    const password = crypto.randomUUID();
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2.5 Defensive Cleanup for Mock Plugin
    console.log(`[Setup] Cleaning up any existing mock plugins...`);
    await prisma.installedPlugin.deleteMany({
        where: { pluginId: { in: ['e2e-mock-plugin', 'e2e-mock-bottom-panel'] } }
    });

    // 3. Clean up any orphaned user and create the test user
    console.log(`[Setup] Upserting test user: ${TEST_USER_EMAIL}`);
    await prisma.user.deleteMany({
        where: { email: TEST_USER_EMAIL }
    });

    await prisma.user.create({
      data: {
        email: TEST_USER_EMAIL,
        name: 'Playwright E2E Tester',
        hashedPassword: hashedPassword,
        role: 'ADMIN',
      },
    });

    // 3.5 Inject the mock plugin for the test environment
    console.log(`[Setup] Injecting mock plugin into database...`);
    const manifestPath = path.join(process.cwd(), 'public', 'e2e-fixtures', 'manifest.json');
    const manifestStr = fs.readFileSync(manifestPath, 'utf-8');
    await prisma.installedPlugin.create({
      data: {
        pluginId: 'e2e-mock-plugin',
        version: '1.0.0',
        config: manifestStr,
        enabled: true
      }
    });

    const bottomManifestPath = path.join(process.cwd(), 'public', 'e2e-fixtures', 'e2e-mock-bottom-panel-manifest.json');
    const bottomManifestStr = fs.readFileSync(bottomManifestPath, 'utf-8');
    await prisma.installedPlugin.create({
      data: {
        pluginId: 'e2e-mock-bottom-panel',
        version: '1.0.0',
        config: bottomManifestStr,
        enabled: true
      }
    });

    // Ensure playwright auth directory exists
    if (typeof storageState === 'string') {
      const authDir = path.dirname(storageState);
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }
    }

    // 4. Perform UI Login
    console.log(`[Setup] Logging in via UI to generate storage state...`);
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    await page.goto(`${baseURL}/login`);
    await page.fill('input[name="email"]', TEST_USER_EMAIL);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for redirect to home
    await page.waitForURL(baseURL);

    // 5. Save storage state
    if (typeof storageState === 'string') {
        await page.context().storageState({ path: storageState });
    } else {
        console.warn("Storage state path is not a string, skipping saving context.")
    }

    await browser.close();
    console.log(`[Setup] Global setup complete.`);
  } catch (error) {
    console.error(`[Setup] Error during global setup:`, error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

export default globalSetup;

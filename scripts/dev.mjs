/**
 * @file dev.mjs
 * @description Orchestrator for the local development environment.
 * Replaces direct usage of 'concurrently' via CLI to allow for optional,
 * cross-platform graceful teardown of the Docker database on exit.
 * @module scripts
 */

import concurrently from 'concurrently';
import kill from 'tree-kill/index.js';
import { execSync } from 'child_process';
import fs from 'fs';
import process from 'process';

// Manually parse .env to avoid external dependencies early in the boot process
const loadEnv = (file) => {
  try {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
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
};

loadEnv('.env');
loadEnv('.env.local'); // .env.local secrets take precedence and must be in process.env before workers spawn

const teardownDbOnExit = process.env.WWV_TEARDOWN_DB_ON_EXIT === 'true' || process.env.WWV_TEARDOWN_DB_ON_EXIT === '1';

const { result, commands } = concurrently(
  [
    { command: 'pnpm run dev:plugins', name: 'plugins', prefixColor: 'magenta' },
    { command: 'pnpm exec next dev', name: 'next', prefixColor: 'blue' }
  ],
  {
    prefix: 'name',
    killOthers: ['failure', 'success']
  }
);

let isShuttingDown = false;

const shutdown = () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('\n🛑 Shutting down dev servers...');

  // Forcefully kill the process tree of each command cross-platform
  commands.forEach(cmd => {
    if (cmd.pid) {
      kill(cmd.pid, 'SIGKILL');
    }
  });

  if (teardownDbOnExit) {
    console.log('📦 Tearing down local PostgreSQL database...');
    try {
      execSync('docker compose stop db', { stdio: 'inherit' });
      console.log('✅ Local database stopped.');
    } catch (e) {
      console.error('⚠️ Failed to stop database container.');
    }
  }

  process.exit(0);
};

// Listen for termination signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

result.then(
  () => process.exit(0),
  () => process.exit(1)
);

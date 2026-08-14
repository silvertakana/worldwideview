#!/usr/bin/env node
/**
 * @file serve-standalone.mjs
 * @description Boot the Next.js standalone production build the way the
 * production Docker image does. `next start` cannot serve an
 * `output: "standalone"` build — Next warns about the mismatch and the
 * served app never hydrates under WebKitGTK (the Playwright CI webkit
 * failure on PR #430). This script mirrors the Dockerfile layout:
 *   1. copies public/ and .next/static/ into .next/standalone (standalone
 *      mode does NOT include static assets — the Dockerfile copies them in
 *      separately), then
 *   2. spawns .next/standalone/server.js on $PORT (default 3000) bound to
 *      0.0.0.0 (mirror of Dockerfile ENV HOSTNAME=0.0.0.0).
 *
 * HOSTNAME is deliberately NOT inherited: CI exports it as the runner
 * hostname, which would make the server listen on an unresolvable address
 * and break Playwright's http://localhost:3001 readiness probe.
 *
 * Used by playwright.config.ts webServer when CI=true.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const standaloneDir = path.join(root, '.next', 'standalone');

if (!fs.existsSync(path.join(standaloneDir, 'server.js'))) {
  console.error('[serve-standalone] .next/standalone/server.js not found. Run `pnpm build` first.');
  process.exit(1);
}

/** Recursive copy that skips files already present and not older than source. */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else if (!fs.existsSync(d) || fs.statSync(s).mtimeMs > fs.statSync(d).mtimeMs) {
      fs.copyFileSync(s, d);
    }
  }
}

// Standalone output does NOT include static assets; copy them in so
// /_next/static/... and /cesium/... resolve (same as the Dockerfile).
console.log('[serve-standalone] copying public/ and .next/static/ into standalone dir');
copyDir(path.join(root, 'public'), path.join(standaloneDir, 'public'));
copyDir(path.join(root, '.next', 'static'), path.join(standaloneDir, '.next', 'static'));

// The standalone server loads env files from its own directory (its cwd is
// .next/standalone), NOT the repo root — `next start` loads them from the
// repo root, which is why the current setup passes on chromium/firefox.
// Runtime secrets (ENCRYPTION_MASTER_KEY, BETTER_AUTH_SECRET, DATABASE_URL)
// must resolve identically, so mirror the Dockerfile, which writes
// .env.production.local into the app root: copy the repo-root env files in.
for (const name of ['.env.production.local', '.env.production', '.env.local', '.env']) {
  const src = path.join(root, name);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(standaloneDir, name));
  }
}

const port = process.env.PORT || '3000';
const hostname = '0.0.0.0'; // mirror Dockerfile ENV HOSTNAME=0.0.0.0
console.log(`[serve-standalone] booting standalone server on ${hostname}:${port}`);

// server.js chdirs into its own directory internally; spawn it there so the
// layout matches the production image (server.js at app root).
const child = spawn(process.execPath, ['server.js'], {
  cwd: standaloneDir,
  env: { ...process.env, PORT: port, HOSTNAME: hostname },
  stdio: 'inherit',
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[serve-standalone] server killed by ${signal}`);
  }
  process.exit(code ?? 1);
});

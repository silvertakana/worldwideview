import concurrently from 'concurrently';
import kill from 'tree-kill/index.js';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';
import process from 'process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadEnv = (file) => {
  try {
    const absPath = path.resolve(__dirname, '..', file);
    if (fs.existsSync(absPath)) {
      const content = fs.readFileSync(absPath, 'utf8');
      content.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
          if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
          if (!(key in process.env)) process.env[key] = value;
        }
      });
    }
  } catch {
    // Ignore read errors
  }
};

loadEnv('.env');

function findFreePort(start) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(start, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => findFreePort(start + 1).then(resolve));
  });
}

const enginePort = await findFreePort(5000);
const projectName = path.basename(process.cwd()).replace(/[^a-z0-9]/gi, '-').toLowerCase();

process.env.WWV_ENGINE_HOST_PORT = String(enginePort);
process.env.NEXT_PUBLIC_WWV_LOCAL_ENGINE_PORT = String(enginePort);
process.env.COMPOSE_PROJECT_NAME = projectName;

console.log(`[dev:all] Engine -> :${enginePort} | Docker project: ${projectName}`);

const teardownDbOnExit =
  process.env.WWV_TEARDOWN_DB_ON_EXIT === 'true' ||
  process.env.WWV_TEARDOWN_DB_ON_EXIT === '1';

const { result, commands } = concurrently(
  [
    { command: 'pnpm dev', name: 'app', prefixColor: 'magenta' },
    { command: 'pnpm dev:backends', name: 'backends', prefixColor: 'blue' },
  ],
  {
    prefix: 'name',
    killOthersOn: ['failure', 'success'],
  }
);

let isShuttingDown = false;

const shutdown = () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('\n[dev:all] Shutting down...');

  commands.forEach(cmd => {
    if (cmd.pid) kill(cmd.pid, 'SIGKILL');
  });

  if (teardownDbOnExit) {
    try {
      execSync('docker compose stop db', { stdio: 'inherit' });
    } catch {
      console.error('[dev:all] Failed to stop database container.');
    }
  }

  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

result.then(
  () => process.exit(0),
  () => process.exit(1)
);

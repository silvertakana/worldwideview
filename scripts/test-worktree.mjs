import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import net from 'node:net';

// 1. Get branch argument
const branchName = process.argv[2];
if (!branchName) {
  console.error('\x1b[31mError: Please provide a worktree branch name.\x1b[0m');
  console.error('Usage: pnpm run test-worktree <branch-name>');
  process.exit(1);
}

const rootDir = process.cwd();

// 2. Find worktree path dynamically
let worktreePath = null;
try {
  const output = execSync('git worktree list --porcelain', { encoding: 'utf8' });
  const blocks = output.trim().split(/\r?\n\r?\n/);
  
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const wtPathLine = lines.find(l => l.startsWith('worktree '));
    const branchLine = lines.find(l => l.startsWith('branch '));
    
    if (wtPathLine && branchLine) {
      const currentBranch = branchLine.substring('branch refs/heads/'.length);
      if (currentBranch === branchName) {
        worktreePath = wtPathLine.substring('worktree '.length);
        break;
      }
    }
  }
} catch (err) {
  console.warn('\x1b[33mWarning: Failed to parse git worktree list.\x1b[0m');
}

// Fallback to legacy behavior if not found via git
if (!worktreePath) {
  const worktreeDirName = branchName.replace(/\//g, '-');
  worktreePath = path.join(rootDir, '.worktrees', worktreeDirName);
}

// 3. Validate worktree exists
if (!fs.existsSync(worktreePath)) {
  console.error(`\x1b[31mError: Worktree directory not found for branch '${branchName}'\x1b[0m`);
  console.error(`Searched path: ${worktreePath}`);
  console.error(`Ensure you have created it using 'git worktree add <path> -b ${branchName}'`);
  process.exit(1);
}

// 3. Setup Environment
console.log(`\x1b[34m[1/5] Checking environment in ${worktreePath}...\x1b[0m`);
const rootEnvPath = path.join(rootDir, '.env.local');
const worktreeEnvPath = path.join(worktreePath, '.env.local');

if (!fs.existsSync(worktreeEnvPath) && fs.existsSync(rootEnvPath)) {
  fs.copyFileSync(rootEnvPath, worktreeEnvPath);
  console.log('Copied .env.local from root.');
}

// 4. Install Dependencies
console.log(`\x1b[34m[2/5] Symlinking modules and generating local clients...\x1b[0m`);
console.log('Running pnpm install in worktree...');
execSync('pnpm install', { cwd: worktreePath, stdio: 'inherit' });

console.log('Generating Prisma Clients (Root)...');
execSync('npx prisma generate', { cwd: worktreePath, stdio: 'inherit' });

console.log('Generating Prisma Clients (Data Engine)...');
const enginePath = path.join(worktreePath, 'packages', 'wwv-data-engine');
if (fs.existsSync(enginePath)) {
  try {
    execSync('npx prisma generate', { cwd: enginePath, stdio: 'inherit' });
  } catch (err) {
    console.warn('\x1b[33m[Warning] Could not generate Data Engine Prisma client. This happens on Windows when another workspace is running and locking the shared pnpm DLL. It is safe to ignore as the client already exists in the cache.\x1b[0m');
  }
}

// 5. Setup databases
console.log(`\x1b[34m[3/5] Setting up local databases...\x1b[0m`);
const rootDataDir = path.join(worktreePath, 'data');
const engineDataDir = path.join(enginePath, 'data');

if (!fs.existsSync(rootDataDir)) fs.mkdirSync(rootDataDir, { recursive: true });
if (fs.existsSync(enginePath) && !fs.existsSync(engineDataDir)) fs.mkdirSync(engineDataDir, { recursive: true });

// 6. Port utility
function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    // Fastify binds to 0.0.0.0, so we must probe 0.0.0.0 instead of localhost
    // otherwise Node might successfully check IPv6 while IPv4 is taken
    server.listen(startPort, '0.0.0.0', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findFreePort(startPort + 1));
      } else {
        reject(err);
      }
    });
  });
}

// 7. Start the Servers
async function start() {
  console.log(`\x1b[34m[4/5] Assigning isolated ports...\x1b[0m`);
  // Start scanning *after* the default main dev ports to absolutely ensure we don't accidentally grab them
  const frontendPort = await findFreePort(3002);
  const backendPort = await findFreePort(5002);

  console.log(`Next.js Frontend Port: \x1b[32m${frontendPort}\x1b[0m`);
  console.log(`Data Engine Backend Port: \x1b[32m${backendPort}\x1b[0m`);

  console.log(`\x1b[34m[4/5] Booting isolated servers...\x1b[0m`);
  
  // Start Backend First
  const backendEnv = { ...process.env, PORT: backendPort.toString() };
  const backendProcess = spawn('pnpm', ['--filter', 'wwv-data-engine', 'dev'], {
    cwd: worktreePath,
    env: backendEnv,
    stdio: 'pipe',
    shell: true
  });

  backendProcess.stdout.on('data', (data) => process.stdout.write(`[\x1b[36mEngine\x1b[0m] ${data}`));
  backendProcess.stderr.on('data', (data) => process.stderr.write(`[\x1b[31mEngine Error\x1b[0m] ${data}`));

  // Start Frontend
  const frontendEnv = {
    ...process.env,
    PORT: frontendPort.toString(),
    WWV_DATA_ENGINE_URL: `http://127.0.0.1:${backendPort}`,
    NEXT_PUBLIC_WS_ENGINE_URL: `ws://127.0.0.1:${backendPort}/stream`
  };

  const frontendProcess = spawn('pnpm', ['dev'], {
    cwd: worktreePath,
    env: frontendEnv,
    stdio: 'pipe',
    shell: true
  });

  frontendProcess.stdout.on('data', (data) => process.stdout.write(`[\x1b[35mNext.js\x1b[0m] ${data}`));
  frontendProcess.stderr.on('data', (data) => process.stderr.write(`[\x1b[31mNext.js Error\x1b[0m] ${data}`));

  // 7. Open Browser
  console.log(`\x1b[34m[5/5] Launching browser...\x1b[0m`);
  setTimeout(() => {
    const url = `http://localhost:${frontendPort}`;
    console.log(`Opening \x1b[32m${url}\x1b[0m...`);
    const startCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    execSync(`${startCmd} ${url}`);
  }, 4000); // Wait 4 seconds for Next to hook up

  process.on('SIGINT', () => {
    backendProcess.kill('SIGINT');
    frontendProcess.kill('SIGINT');
    process.exit();
  });
}

start().catch(console.error);

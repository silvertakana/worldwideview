import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Load environment variables manually since dotenv might not be installed globally
const loadEnv = (file) => {
  try {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      content.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          // Remove quotes
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

const skipLocalDb = process.env.WWV_SKIP_LOCAL_DB === 'true' || process.env.WWV_SKIP_LOCAL_DB === '1';

if (skipLocalDb) {
  console.log('⏭️ Skipping local PostgreSQL startup (WWV_SKIP_LOCAL_DB is set).');
  process.exit(0);
}

console.log('🚀 Checking local PostgreSQL database...');

try {
  // Check if docker is installed
  try {
    execSync('docker --version', { stdio: 'ignore' });
  } catch (e) {
    console.log('⚠️ Docker is not installed or not in PATH. Skipping local database startup.');
    console.log('💡 If you want to run a local database automatically, please install Docker Desktop.');
    process.exit(0);
  }

  // Start the db service and wait for it to be healthy
  console.log('📦 Starting PostgreSQL via Docker Compose...');
  execSync('docker compose up -d --wait db', { stdio: 'inherit' });

  console.log('✅ Local PostgreSQL database is ready!');

} catch (error) {
  console.error('❌ Failed to start local database:', error.message);
  console.log('💡 Ensure that docker is running and try again');
  console.log('💡 You may need to start it manually or set WWV_SKIP_LOCAL_DB=true to use an external database.');
}

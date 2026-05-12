import { execSync } from 'child_process';

const dbUrl = process.env.DATABASE_URL || '';
const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('host.docker.internal') || dbUrl.includes('postgres:postgres@db:5432');

if (!isLocal) {
  console.error("❌ ERROR: DATABASE_URL points to a remote database.");
  console.error("   Running 'prisma db push --accept-data-loss' on production/staging data is forbidden.");
  console.error("   If you truly need to migrate a remote db, run prisma db push manually.");
  process.exit(1);
}

console.log("🔒 Local database detected. Safely running prisma db push...");
execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });

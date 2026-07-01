import { execSync } from 'child_process';

const dbUrl = process.env.DATABASE_URL || '';

if (!dbUrl) {
  console.error("❌ ERROR: DATABASE_URL is missing.");
  console.error("   Did you forget to run 'pnpm run setup' to generate your .env file?");
  process.exit(1);
}

const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('host.docker.internal') || dbUrl.includes('postgres:postgres@db:5432');

if (!isLocal) {
  console.error("❌ ERROR: DATABASE_URL points to a remote database.");
  console.error("   Running 'prisma db push --accept-data-loss' on production/staging data is forbidden.");
  console.error("   If you truly need to migrate a remote db, run prisma db push manually.");
  process.exit(1);
}

// Derive shadow database name from the main database name
const dbNameMatch = dbUrl.match(/\/([^/?]+)(\?|$)/);
const mainDbName = dbNameMatch ? dbNameMatch[1] : 'worldwideview';
const shadowDbName = `${mainDbName}_shadow`;

// Ensure shadow database exists (Prisma 7 requires separate shadow DB for db push).
// Find the PostgreSQL container dynamically by image ancestor instead of hardcoding.
try {
  const containerName = execSync(
    'docker ps --filter "ancestor=postgres" --format "{{.Names}}" | head -1',
    { encoding: 'utf8' },
  ).trim();
  if (containerName) {
    execSync(`docker exec ${containerName} psql -U postgres -c "CREATE DATABASE ${shadowDbName};"`, { stdio: 'pipe' });
  }
} catch {
  // Database already exists — this is expected on subsequent runs.
}

console.log("🔒 Local database detected. Safely running prisma db push...");
execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });

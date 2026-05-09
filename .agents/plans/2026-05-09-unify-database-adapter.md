# Unify Database Adapter (PostgreSQL-Only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the dual SQLite/PostgreSQL database system with a single PostgreSQL adapter, using Prisma's built-in `prisma dev` for zero-install local development.

**Architecture:** The app currently has two database paths — `@prisma/adapter-better-sqlite3` for local and `@prisma/adapter-pg` for cloud — which causes constant migration conflicts and config drift. We unify to `@prisma/adapter-pg` everywhere. Local developers use `npx prisma dev` (PGLite-backed local Postgres managed by Prisma CLI) or their own Postgres instance. Production connects to Supabase via the same adapter and connection string swap.

**Tech Stack:** Prisma 7, `@prisma/adapter-pg`, `pg`, PostgreSQL, Next.js 16

---

## File Structure

| Action | File | Responsibility |
|---|---|---|
| Modify | `prisma/schema.prisma` | Change provider to `postgresql` |
| **Rewrite** | `src/lib/db.ts` | Single PostgreSQL adapter factory |
| Delete | `src/core/adapters/db.ts` | Remove cloud-branch adapter factory (merge into `db.ts`) |
| Modify | `package.json` | Remove `better-sqlite3` + adapter deps, add `pg` |
| Modify | `next.config.ts` | Remove `better-sqlite3` from `serverExternalPackages` |
| Modify | `docker-entrypoint.sh` | Update comments, remove SQLite references |
| Modify | `Dockerfile` | Remove SQLite build step, update env defaults |
| Modify | `local-dev.ps1` | Add `prisma dev` startup guidance |
| Modify | `.env` | Change default `DATABASE_URL` to local PostgreSQL |
| Modify | `prisma.config.ts` | No changes needed (already reads `DATABASE_URL`) |
| Modify | `scripts/cleanup-plugins.ts` | Use shared `db.ts` instead of hardcoded SQLite |
| Modify | `scripts/manage-users.ts` | Use shared `db.ts` instead of hardcoded SQLite |
| Keep | `scripts/migrate-aviation-history.ts` | This is a one-off Supabase-to-SQLite migration tool. Leave as-is but mark deprecated |
| **Delete** | `prisma/migrations/` | Remove old SQLite migrations (will regenerate for PostgreSQL) |
| **Create** | `prisma/migrations/` | Fresh PostgreSQL init migration |

---

### Task 1: Update Prisma Schema Provider

**Files:**
- Modify: `prisma/schema.prisma:1-6`

- [x] **Step 1: Change the datasource provider from SQLite to PostgreSQL**

Open `prisma/schema.prisma` and replace the datasource block:

```prisma
// Prisma schema — PostgreSQL for all environments.
// Local dev: use `npx prisma dev` for a zero-install local PGLite instance.
// Cloud/Production: set DATABASE_URL to your Supabase/Postgres connection string.

datasource db {
  provider = "postgresql"
}
```

Leave the `generator` block and all models unchanged.

- [x] **Step 2: Verify the schema is valid**

Run:
```powershell
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid.`

- [x] **Step 3: Commit**

```powershell
git add prisma/schema.prisma
git commit -m "refactor(db): switch schema provider from sqlite to postgresql"
```

---

### Task 2: Remove SQLite Dependencies

**Files:**
- Modify: `package.json:22-80`
- Modify: `next.config.ts:5`

- [x] **Step 1: Remove better-sqlite3 packages from package.json**

In `package.json`, remove these lines from `dependencies`:
```diff
-    "@prisma/adapter-better-sqlite3": "^7.5.0",
```

Remove from `pnpm.onlyBuiltDependencies`:
```diff
-      "better-sqlite3",
```

Ensure `@prisma/adapter-pg` and `pg` remain (they're already present):
```json
"@prisma/adapter-pg": "^7.8.0",
"pg": "^8.20.0",
```

- [x] **Step 2: Update serverExternalPackages in next.config.ts**

In `next.config.ts` line 5, replace:
```typescript
serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3", "@prisma/client", "prisma"],
```

With:
```typescript
serverExternalPackages: ["@prisma/client", "prisma", "pg"],
```

- [x] **Step 3: Install to update lockfile**

Run:
```powershell
pnpm install
```

Expected: Clean install with no `better-sqlite3` compilation step.

- [x] **Step 4: Commit**

```powershell
git add package.json next.config.ts pnpm-lock.yaml
git commit -m "refactor(db): remove better-sqlite3 dependencies"
```

---

### Task 3: Rewrite the Database Adapter Factory

**Files:**
- Rewrite: `src/lib/db.ts`

- [x] **Step 1: Replace db.ts with a unified PostgreSQL adapter**

Replace the entire contents of `src/lib/db.ts` with:

```typescript
import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * Prisma client singleton — PostgreSQL only.
 *
 * Local dev:  Run `npx prisma dev` for a zero-install local Postgres.
 * Production: Set DATABASE_URL to your Supabase/Postgres connection string.
 *
 * Uses globalThis to survive Next.js HMR in development.
 */

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error(
            "[db] DATABASE_URL is not set. " +
            "Run `npx prisma dev` for local development, " +
            "or set DATABASE_URL to your PostgreSQL connection string."
        );
    }

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    return new PrismaClient({ adapter } as any);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}
```

> **Note:** The `feature/cloud-hosting-core` branch has a more complex version at `src/core/adapters/db.ts` with tenant isolation via `applyTenantIsolation()`. When merging that branch later, the tenant isolation extension should be layered on top of this unified base — it does NOT need a separate SQLite path.

- [x] **Step 2: Verify TypeScript compilation**

Run:
```powershell
npx tsc --noEmit --pretty 2>&1 | Select-String "db.ts"
```

Expected: No errors related to `db.ts`.

- [x] **Step 3: Commit**

```powershell
git add src/lib/db.ts
git commit -m "refactor(db): unify adapter to postgresql-only via PrismaPg"
```

---

### Task 4: Update Utility Scripts

**Files:**
- Modify: `scripts/cleanup-plugins.ts`
- Modify: `scripts/manage-users.ts`

- [x] **Step 1: Rewrite cleanup-plugins.ts to use shared db**

Replace the entire contents of `scripts/cleanup-plugins.ts`:

```typescript
import { PrismaClient } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
    const plugins = await prisma.installedPlugin.findMany();
    console.log("Installed plugins:");
    plugins.forEach((p) => console.log(`  ${p.pluginId} | config: ${p.config.substring(0, 60)}`));

    const geojson = plugins.find((p) => p.pluginId === "geojson");
    if (geojson) {
        await prisma.installedPlugin.delete({ where: { id: geojson.id } });
        console.log("\nDeleted orphaned 'geojson' record.");
    } else {
        console.log("\nNo orphaned 'geojson' record found.");
    }

    const remaining = await prisma.installedPlugin.findMany();
    console.log("\nRemaining plugins:");
    remaining.forEach((p) => console.log(`  ${p.pluginId}`));

    await prisma.$disconnect();
}

main().catch(console.error);
```

- [x] **Step 2: Rewrite manage-users.ts to use shared db**

Replace the entire contents of `scripts/manage-users.ts`:

```typescript
import { PrismaClient } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hashSync } from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
    const action = process.argv[2];

    if (action === "list") {
        const users = await prisma.user.findMany();
        if (users.length === 0) {
            console.log("No users found — visit /setup to create one.");
        } else {
            users.forEach((u) =>
                console.log(`  ${u.email} | ${u.name} | ${u.role} | ${u.createdAt}`)
            );
        }
    } else if (action === "reset") {
        const email = process.argv[3];
        const newPass = process.argv[4];
        if (!email || !newPass) {
            console.log("Usage: tsx scripts/manage-users.ts reset <email> <password>");
            return;
        }
        const hashed = hashSync(newPass, 12);
        await prisma.user.update({
            where: { email },
            data: { hashedPassword: hashed },
        });
        console.log(`Password reset for ${email}`);
    } else if (action === "delete-all") {
        await prisma.user.deleteMany();
        console.log("All users deleted — visit /setup to create a new admin.");
    } else {
        console.log("Usage: tsx scripts/manage-users.ts <list|reset|delete-all>");
    }

    await prisma.$disconnect();
}

main().catch(console.error);
```

- [x] **Step 3: Add deprecation notice to migrate-aviation-history.ts**

Add this comment at the top of `scripts/migrate-aviation-history.ts`:

```typescript
/**
 * @deprecated This script uses better-sqlite3 directly to migrate data
 * from Supabase into the legacy data engine's SQLite database.
 * It is NOT part of the main application's database layer.
 * It will be removed once the data engine migration is complete.
 */
```

- [x] **Step 4: Commit**

```powershell
git add scripts/cleanup-plugins.ts scripts/manage-users.ts scripts/migrate-aviation-history.ts
git commit -m "refactor(scripts): update utility scripts to use postgresql adapter"
```

---

### Task 5: Create Fresh PostgreSQL Migration

**Files:**
- Delete: `prisma/migrations/` (entire directory)
- Create: `prisma/migrations/YYYYMMDD_init/migration.sql` (generated by Prisma)

- [x] **Step 1: Delete old SQLite migrations**

```powershell
Remove-Item -Recurse -Force prisma/migrations
```

- [x] **Step 2: Ensure a local PostgreSQL is available**

Either:
- Run `npx prisma dev` in a separate terminal, OR
- Use your existing local PostgreSQL at `127.0.0.1:5432`

Verify the connection string in `.env.local` points to a reachable PostgreSQL instance:
```
DATABASE_URL="postgresql://postgres:password@127.0.0.1:5432/postgres?schema=public"
```

- [x] **Step 3: Reset and create initial migration**

```powershell
npx prisma migrate reset --force
npx prisma migrate dev --name init
```

Expected output:
```
Applying migration `YYYYMMDDHHMMSS_init`
The following migration(s) have been created and applied...
```

- [x] **Step 4: Verify migration_lock.toml says postgresql**

```powershell
Get-Content prisma/migrations/migration_lock.toml
```

Expected:
```
provider = "postgresql"
```

- [x] **Step 5: Commit**

```powershell
git add prisma/migrations
git commit -m "feat(db): create initial postgresql migration"
```

---

### Task 6: Update Dockerfile and Entrypoint

**Files:**
- Modify: `Dockerfile:11,36-38,49,54`
- Modify: `docker-entrypoint.sh:3-5`

- [x] **Step 1: Update Dockerfile**

Make these changes to `Dockerfile`:

**Line 11** — Remove `python3 make g++` (no longer need to compile better-sqlite3 native bindings):
```dockerfile
RUN apk add --no-cache python3 make g++
```
Replace with:
```dockerfile
# python3/make/g++ no longer needed — removed better-sqlite3 native compilation
```

**Lines 36-38** — Remove the conditional SQLite build step entirely:
```dockerfile
# Create an empty SQLite database with all tables applied ONLY IF NOT CLOUD
# (For cloud, we'll run migrations against Postgres at runtime)
RUN if [ "$NEXT_PUBLIC_WWV_EDITION" != "cloud" ]; then mkdir -p ./data && DATABASE_URL=file:./data/wwv.db npx prisma migrate deploy; fi
```
Replace with:
```dockerfile
# Database migrations run at container startup via docker-entrypoint.sh
# DATABASE_URL must be set to a PostgreSQL connection string
```

**Line 49** — Keep `prisma` global install (needed for `migrate deploy` at runtime).

**Line 54** — Remove the SQLite default DATABASE_URL:
```dockerfile
ENV DATABASE_URL=file:./data/wwv.db
```
Replace with:
```dockerfile
# DATABASE_URL must be provided via environment variable (no default)
# Example: postgresql://user:pass@host:5432/dbname
```

- [x] **Step 2: Update docker-entrypoint.sh comments**

Replace lines 2-5 of `docker-entrypoint.sh`:
```bash
# ─── Docker Entrypoint ───────────────────────────────────────
# Ensures the SQLite database exists and is migrated before
# starting the application. On first run with a fresh volume
# the DB file won't exist yet, so we run prisma migrate deploy.
```

With:
```bash
# ─── Docker Entrypoint ───────────────────────────────────────
# Ensures the PostgreSQL database is migrated before starting
# the application. DATABASE_URL must point to a PostgreSQL
# instance (Supabase, self-hosted, etc).
```

Remove `mkdir -p ./data` from line 9 (no longer creating a local SQLite file):
```bash
set -e

echo "[entrypoint] Running database migrations..."
prisma migrate deploy
echo "[entrypoint] Migrations complete."
```

- [x] **Step 3: Commit**

```powershell
git add Dockerfile docker-entrypoint.sh
git commit -m "refactor(docker): remove sqlite from build and runtime"
```

---

### Task 7: Update Environment Defaults and Dev Scripts

**Files:**
- Modify: `.env:1`
- Modify: `package.json:13` (predev script)
- Modify: `local-dev.ps1`

- [x] **Step 1: Update .env default DATABASE_URL**

Replace line 1 of `.env`:
```
DATABASE_URL=file:./data/wwv.db
```

With:
```
# PostgreSQL connection string.
# For local dev: run `npx prisma dev` and use the URL it prints.
# For production: set to your Supabase/Postgres connection string.
# DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/worldwideview
```

> **Important:** The default is now commented out. The `.env.local` file (or `npx prisma dev`) must provide the actual value. This forces contributors to explicitly set up their database rather than silently falling back to a potentially broken SQLite path.

- [x] **Step 2: Simplify the predev script**

In `package.json`, the `predev` script currently runs `npx prisma migrate deploy`. This will fail if no Postgres is running. Change it to only copy Cesium assets and generate the Prisma client:

```json
"predev": "npx prisma generate && node scripts/copy-cesium.mjs",
```

> **Rationale:** `prisma migrate deploy` should only run in production (Docker entrypoint) or explicitly by the developer. During local dev, `npx prisma dev` handles migrations automatically.

- [x] **Step 3: Update local-dev.ps1**

Replace the entire contents of `local-dev.ps1`:

```powershell
Write-Host "[*] Setting up WorldWideView for Local Development..."

# Check for pnpm
try {
    $null = Get-Command pnpm -ErrorAction Stop
} catch {
    Write-Host "[Error] pnpm is not installed or not in PATH."
    Write-Host "Please install it first: https://pnpm.io/installation"
    exit 1
}

Write-Host "[*] Installing dependencies..."
pnpm install

Write-Host "[*] Running initial setup (generating secrets)..."
pnpm run setup

Write-Host "[*] Generating Prisma client..."
npx prisma generate

# Check for the sibling Data Engine repository
if (-not (Test-Path "../wwv-data-engine")) {
    Write-Host ""
    Write-Host "=====================================================================" -ForegroundColor Yellow
    Write-Host "[!] NOTICE: Local Data Engine not found at ../wwv-data-engine" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Frontend-Only Mode: You are developing the frontend UI." -ForegroundColor Green
    Write-Host "WorldWideView will automatically stream data from the Cloud Engine." -ForegroundColor Green
    Write-Host ""
    Write-Host "Full-Stack Mode: If you want to develop backend data seeders, you" -ForegroundColor Cyan
    Write-Host "must clone the open-source data engine as a sibling directory:" -ForegroundColor Cyan
    Write-Host "  cd ..; git clone https://github.com/silvertakana/wwv-data-engine"
    Write-Host "  cd wwv-data-engine; pnpm install"
    Write-Host "=====================================================================" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "[!] DATABASE SETUP REQUIRED" -ForegroundColor Cyan
Write-Host ""
Write-Host "WorldWideView uses PostgreSQL. Choose one option:" -ForegroundColor White
Write-Host ""
Write-Host "  Option A (Easiest): Run Prisma's built-in local database:" -ForegroundColor Green
Write-Host "    npx prisma dev" -ForegroundColor Yellow
Write-Host "    (Copy the DATABASE_URL it prints into your .env.local file)" -ForegroundColor Gray
Write-Host ""
Write-Host "  Option B: Use your own PostgreSQL or Supabase instance:" -ForegroundColor Green
Write-Host "    Set DATABASE_URL in .env.local to your connection string" -ForegroundColor Gray
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[*] Starting local Next.js frontend server..."
Write-Host "   (To run the data engine backends concurrently, run: pnpm dev:all)"
pnpm run dev
```

- [x] **Step 4: Commit**

```powershell
git add .env package.json local-dev.ps1
git commit -m "refactor(dev): update env defaults and dev scripts for postgresql"
```

---

### Task 8: Run Tests and Validate

**Files:**
- No file changes — validation only

- [x] **Step 1: Generate Prisma client**

```powershell
npx prisma generate
```

Expected: `Generated Prisma Client to ./src/generated/prisma`

- [x] **Step 2: Run the test suite**

```powershell
pnpm test
```

Expected: All tests pass. The repository tests mock `db.ts`, so the adapter change should be transparent to them.

- [x] **Step 3: Start the dev server**

Ensure your `.env.local` has a valid `DATABASE_URL` pointing to PostgreSQL, then:

```powershell
pnpm run dev
```

Expected: Server starts at `http://localhost:3000` without `P3005` or `P3018` errors.

- [x] **Step 4: Verify database operations work**

1. Navigate to `http://localhost:3000/setup` — create a test user
2. Log in
3. Open the Plugins panel — verify installed plugins load
4. Star a favorite entity — verify it persists across reload

- [x] **Step 5: Final commit**

```powershell
git add -A
git commit -m "test(db): verify postgresql-only adapter works end-to-end"
```

---

## Post-Implementation Notes

### For the `feature/cloud-hosting-core` merge

When merging the cloud-hosting-core branch back into main, the `src/core/adapters/db.ts` file with `applyTenantIsolation()` should be integrated into `src/lib/db.ts` as a wrapper around the single `PrismaPg` adapter. The conditional SQLite path in that file can be completely removed.

### For self-hosted Docker users

Add a note to the release changelog:

> **Breaking Change:** WorldWideView now requires a PostgreSQL database. SQLite is no longer supported.
> Self-hosted users must provide a `DATABASE_URL` environment variable pointing to a PostgreSQL instance.
> The easiest option is a free Supabase project, or run `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=pass postgres:17-alpine` alongside your WWV container.

### For the migrate-aviation-history.ts script

This script uses `better-sqlite3` directly to talk to the data engine's separate SQLite database (not the platform database). It is unrelated to this migration and can remain as-is. If `better-sqlite3` is needed for this script, install it as a `devDependency` only, or move the script to the data engine repo where it belongs.

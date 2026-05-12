# Deployment, Testing, and Operations

## Development Commands

```bash
pnpm install          # Install all workspace dependencies
pnpm run setup        # Generate .env.local with AUTH_SECRET (first-time setup)
pnpm dev              # Next.js frontend only (auto-runs prisma db push + copy-cesium)
pnpm dev:all          # Frontend + wwv-data-engine (via Docker Compose) concurrently
pnpm dev:backends     # Starts the local data engine + Redis via Docker Compose
pnpm build            # Production build
pnpm test             # Run all Vitest tests (scoped to src/lib, src/core, src/plugins)
pnpm db:reset         # Reset and re-migrate the frontend database (destructive)
pnpm start:backends   # Legacy command for standalone Fastify backends
pnpm clean:backends   # Wipe all plugin database records
pnpm run scaffold-osm-plugin <name>  # Generate a new plugin from scaffold
pnpm dev:plugins      # File watcher for local-plugins/ directory (runs automatically in dev)
node packages/wwv-cli/dist/index.js create <name> --local # Scaffold a new local plugin
node packages/wwv-cli/dist/index.js link <name>           # Promote a local plugin to packages/
```

Frontend runs at `http://localhost:3000`.

## Deployment

- **Docker**: Multi-stage Dockerfile using the Extractor Pattern (`deps` → `builder` → `runner`). The `node_modules` folders must be explicitly untracked in from `git` across the workspace to prevent corrupted BuildKit contextual cache overlaps during the `COPY . .` stage.
- **Standalone output**: `next.config.ts` uses `output: "standalone"`.
- **Cesium assets**: Copied to `public/cesium/` via `scripts/copy-cesium.mjs` at build time, excluded from output tracing.
- **Prisma Configuration**: `prisma.config.ts` must export a native javascript object instead of dynamically importing CLI wrapper binaries (`prisma/config` or `dotenv`). The standalone Next.js tracer strips CLI devDependencies during the build, which will cause fatal runtime container crashes if imported.
- **Data Engine**: The single runner container defined in `docker-compose.yml`, proxied via `next.config.ts` rewrites.
- **Coolify**: Deployed via Dockerfile builder natively mapping environment variables continuously into the container shell.
- **Docker volumes**: Ensure PostgreSQL data and Redis volumes are mounted for persistence.

## Testing Strategy

- **Framework**: Vitest with jsdom environment
- **Coverage**: `src/lib/**`, `src/core/**`, `src/plugins/**`
- **Run**: `pnpm test` (or `vitest run`)
- **Key test files**: `rateLimit.test.ts`, `edition.test.ts`, `demoAdmin.test.ts`, `DeclarativePlugin.test.ts`, `cors.test.ts`, `repository.test.ts`, `marketplaceToken.test.ts`

## Security Headers

Configured in `next.config.ts` `headers()`:
- **CSP**: Restrictive with exceptions for CesiumJS (`unsafe-eval`, `unsafe-inline`), camera streams (`http: https:`), and analytics
- **X-Frame-Options**: DENY
- **X-Content-Type-Options**: nosniff
- **Referrer-Policy**: strict-origin-when-cross-origin
- **Permissions-Policy**: camera/microphone disabled, geolocation self-only




---

## Package Manager

The project uses **pnpm workspaces**. All `npm` commands in older docs/scripts should be treated as `pnpm`.

```bash
pnpm install          # install all workspace deps
pnpm run dev          # start dev server ONLY (worldwideview/)
pnpm run dev:all      # start ALL services concurrently (worldwideview, data-engine, marketplace)
pnpm run build        # production build
```

---

## Local Dev Setup

```
1. Clone repo
2. pnpm install
3. pnpm run setup     # generates .env.local with AUTH_SECRET, copies .env.example
4. pnpm run dev:all   # predev: prisma migrate deploy + copy-cesium.mjs → then starts all services
5. Open http://localhost:3000
```

**Marketplace:** `cd worldwideview-marketplace && pnpm run dev` → http://localhost:3001

**Database auto-creates** on first run via `predev` script — no manual DB setup required.

---

## Database Operations

**All SQL from `c:\dev\worldwideview`:**

```powershell
npx prisma db execute --sql "<SQL>"
```

> Stop the dev server first to avoid "database is locked" errors.

### Common Commands

```powershell
# View row counts (all tables)
npx prisma db execute --sql "SELECT 'users' AS t, COUNT(*) AS n FROM users UNION ALL SELECT 'aviation_history', COUNT(*) FROM aviation_history UNION ALL SELECT 'installed_plugins', COUNT(*) FROM installed_plugins UNION ALL SELECT 'settings', COUNT(*) FROM settings;"

# List installed plugins
npx prisma db execute --sql "SELECT pluginId, version, installedAt FROM installed_plugins ORDER BY installedAt DESC;"

# Clear all installed plugins
npx prisma db execute --sql "DELETE FROM installed_plugins;"

# List settings
npx prisma db execute --sql "SELECT key, value FROM settings;"

# Set/update a setting
npx prisma db execute --sql "INSERT INTO settings (key, value) VALUES ('<key>', '<value>') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;"

# Prune aviation history older than 7 days
npx prisma db execute --sql "DELETE FROM aviation_history WHERE timestamp < NOW() - INTERVAL '7 days';"

# Vacuum (reclaim disk space after pruning)
npx prisma db execute --sql "VACUUM FULL;"
```

---

## Data Engine & Data Recovery

The secondary backend (Data Engine) handles high-volume API ingestion and pushes active snapshots to Upstash Redis. Because its PostgreSQL database is completely wiped on fresh Coolify deployments if volumes aren't preserved, it uses **Self-Healing Architecture**.

**How Recovery Works:**
1. Upon startup, or during the 60-second cron cycle, the seeder checks if the target table (e.g., `iranwar_events`) is empty.
2. If empty, the engine instantly hydrates the PostgreSQL database and the Upstash Redis cache from the committed fallback payload (e.g., `data/fallback/iranwar_seed.json`).
3. To **force a rapid recovery** locally (such as when testing new scraper data), simply wipe the table and let the minute-tick refill it via `npx prisma db execute --sql "DELETE FROM iranwar_events;"`.

**OSINT Scraping & Hydration Best Practices:**
Utility scripts (like `hydrate.ts`) exist to repair or enrich the fallback seed block offline. Important takeaways from building these scrapers:
- **Location Mapping:** Always append structured `_osint_meta.coordinates: {lat, lng}`. Without exact coordinates, the SDK defaults to Null Island or scatters points uniformly across the globe (declutter grid effect).
- **Tracking URL Resolution:** News aggregators (like Bing News RSS) wrap URLs in tracking redirect pages (`apiclick.aspx`). Never serve these directly to the frontend. Use `cheerio` to fetch the tracking page, parse the `<noscript><meta refresh="URL=..."></noscript>` node, extract the *actual* news URL, and then scrape the destination article for `og:image` and `og:video` tags.
- **Frontend Sync:** Ensure Next.js schema mapping in the plugin (`wwv-plugin-xyz/src/index.ts`) perfectly mirrors the enriched fields so they render correctly in the UI.

### Schema Changes

```powershell
npx prisma db push             # sync schema changes to DB (non-destructive)
npx prisma migrate dev --name "<description>"  # create + apply a migration
npx prisma generate            # regenerate Prisma client types after schema change
npx prisma studio              # visual DB browser at http://localhost:5555
```

### Full Reset

```powershell
# Stop dev server first
Remove-Item c:\dev\worldwideview\data\wwv.db
npx prisma db push
pnpm run dev
```

### Browser Cache Clearing

```javascript
// Clear IndexedDB entity cache
indexedDB.deleteDatabase("worldwideview-cache");

// Clear localStorage user API keys
Object.keys(localStorage)
  .filter(k => k.startsWith("wwv_"))
  .forEach(k => localStorage.removeItem(k));
```

Known `wwv_*` localStorage keys (defined in `src/lib/userApiKeys.ts`):
- `wwv_key_google_maps`
- `wwv_key_nasa_firms`

Hard refresh: `Ctrl+Shift+R`

---

## DB Troubleshooting

| Error | Fix |
|---|---|
| "Database is locked" | Stop the dev server first |
| "Table does not exist" | Run `npx prisma db push` |
| "Plugin still shows after clearing" | Hard-refresh (`Ctrl+Shift+R`) or clear IndexedDB |
| DB file is very large | Prune aviation history + run `VACUUM` |
| Prisma client types are stale | Run `npx prisma generate` |

---

## Creating Static OSM Plugins

See full guide: `.agents/skills/osm-static-plugin-creation.md`

**Quick start:**
```bash
node scripts/scaffold-osm-plugin.mjs '{
  "name": "volcanoes",
  "displayName": "Volcanoes",
  "osmTag": "natural=volcano",
  "icon": "Mountain",
  "color": "#ef4444",
  "category": "Natural Disaster"
}'
```

**Manual Overpass API query (PowerShell):**
```powershell
$tag = '"natural"="volcano"'
$body = "data=[out:json][timeout:300];(node[$tag];way[$tag];relation[$tag];);out center;"
Invoke-RestMethod -Uri 'https://overpass-api.de/api/interpreter' -Method Post -Body $body -OutFile 'tmp/raw_data.json'
```

**Note:** OSM data is licensed under **ODbL** — include attribution in plugin READMEs.

---

## npm Plugin Publishing

See full guide: `.agents/skills/version-control/npm-plugin-publishing.md`

```bash
# First-time publish
pnpm publish --workspace=packages/wwv-plugin-<name> --access public

# Future versions — via Trusted Publishing (GitHub Actions CI/CD)
```

---

## Git / Version Control

See full guide: `.agents/skills/version-control/git-version-control.md`

**Commit convention:** `feat:`, `fix:`, `chore:`, `docs:` prefixes.
**Commit when:** A new feature is completed (per project rules).

---

## Security Checks

See full guide: `.agents/skills/security/security-check.md`

---

## Deployment

**Host Server:**
The production Coolify instance runs on a local server at `192.168.68.64`. Direct SSH access: `ssh root@192.168.68.64`.

**CI/CD Flow:**
1. Push to `silvertakana/worldwideview`
2. Coolify webhook triggers → automated BuildKit deployment on the host server.

**Coolify Deployment Rules & Gotchas (The "Redis 500k" Rule):**
- **Coolify Pulls from GitHub:** Coolify does *not* deploy your local workspace files. It strictly clones the repository from GitHub.
- **Push Before You Deploy:** If you make a critical infrastructure or optimization fix locally (e.g., swapping a massive `HSET` pipeline for a compressed 5-min throttled `setLiveSnapshot`), you **must** `git commit` and `git push` those changes to the `main` branch before triggering a Coolify deployment.
- **The "Rollback DDOS" Risk:** If you update environmental variables (like a new Upstash Redis URL) inside Coolify and deploy *without* pushing your local optimized code to GitHub, Coolify will pull the *older, unoptimized* repository code and aim it at your new endpoints. This will immediately exhaust the 500,000 requests/month Upstash free limit.
- **Redis Connection Errors:** If the data engine crashes on startup with `MaxRetriesPerRequestError: Reached the max retries per request limit (which is 3)` and `ECONNRESET`, the `REDIS_URL` in your Coolify environment variables is incorrectly using `redis://` instead of the TLS-required `rediss://`.
- **Immediate Rollback on Failure:** Whenever a Coolify deployment fails or introduces a critical bug (such as rate-limit exhaustion), **immediately select the last known working deployment in the Coolify dashboard and redeploy it.** Do not leave a broken deployment hanging while trying to debug directly in production. Roll back to stability first, debug locally, commit the verified fix, and then deploy forward.

**Local verification:** 
Before pushing infrastructure changes, run `docker build -t wwv-test .` to verify that the Next.js `standalone` isolated multi-stage build works correctly.

**Critical Docker/BuildKit Patterns:**
- **No Tracked `node_modules`:** Never track `node_modules` in git. It will severely break the Docker `COPY . .` BuildKit cache stage, as it attempts to overwrite the internally symlinked modules from the `deps` stage with the non-symlinked folders from git, causing cryptic `cannot copy to non-directory` errors.
- **Prisma 7 in Standalone:** Prisma v7 strictly forbids `url = env("DATABASE_URL")` in `schema.prisma` if `prisma.config.ts` exists. You *must* provide the `url` property in `prisma.config.ts`.
- **The `dotenv` Paradox:** Next.js `standalone` output does NOT automatically trace CLI tool devDependencies (like `dotenv`). If you import `dotenv` in `prisma.config.ts`, the production runner container will crash in a reboot loop. *Solution:* `prisma.config.ts` must use native Node `fs` and `path` to gracefully read from `.env` as a fallback, exporting a plain Javascript object without CLI wrappers.
- **Standalone Scripts & Next.js Typechecking:** Next.js `pnpm build` triggers `tsc`. By default, this will aggressively typecheck the `scripts/` directory. One-off migration scripts that import backend-only dependencies (like `pg`) will fail the global build. Always ensure `"scripts"` is added to the `"exclude"` array in `tsconfig.json`.
- **WSL2 / Docker Memory Bloat:** Next.js `standalone` + `pnpm workspaces` caching takes roughly 7GB to 10GB of virtual disk space and maxes out WSL2 memory during `docker-compose build`. Avoid building complex monorepos locally unless necessary. To reclaim local BuildKit disk space: `docker builder prune -a -f`. To reclaim WSL RAM: `wsl --shutdown`.
- **TypeScript NodeNext ESM Extensions:** By default in strict NodeNext ESM, backend scripts compiled via TypeScript (like `server.ts`) require dynamic imports to explicitly list the extension. You MUST write `await import('./routes/index.js')`, even if the underlying code is a `.ts` file, or the Docker compilation will fail with `TS2834`.
- **Git vs Docker Context Bloat:** Ensure `.dockerignore` ruthlessly excludes generated artifacts (e.g., `artifacts/`, `performance/`). Ensure `.gitignore` strips large binary caches like heavy database seed files inside `packages/*/data/` to prevent GitHub from bouncing commits exceeding the 100MB chunk limit.
- **Host Resource Exhaustion & Implicit Failures:** Complex multi-stage pnpm builds generate massive amounts of intermediate layer cache. If the Coolify host server reaches 100% disk capacity during an active deployment, the build logs will silently truncate and die abruptly with no explicit `pnpm` error. Worse, services like PostgreSQL (`coolify-db`) will instantly crash because they cannot write lock files, causing total system outages. Always maintain at least 30-40GB of free space on deployment hosts before auto-deploying via Coolify.


**Local update:** `git pull && pnpm install && pnpm run dev`

---

## Disk Space Management & Monitoring

The Docker build uses `standalone` output to minimize image size. The `copy-cesium.mjs` script copies only the required Cesium assets into `public/` — avoids shipping the entire Cesium package (300MB+) in the build.

**Host Server Maintenance:**
On Coolify deployment targets (e.g., `192.168.68.64`), dangling BuildKit caches and orphaned images will eventually consume 100% of the disk.
- To recover a crashed server: SSH into the host and run `docker system prune -a -f`.
- **Proactive Monitoring:** Use the `netdata-remote` MCP server to poll or setup alerts for the host disk space. It is highly recommended to set a warning alert when disk usage exceeds 80%.

**Application Database Growth:**
Aviation history can grow large. Prune regularly:
```powershell
npx prisma db execute --sql "DELETE FROM aviation_history WHERE timestamp < datetime('now', '-7 days');"
npx prisma db execute --sql "VACUUM;"
```

---

## Terminology Quick Reference

| Term | Definition |
|---|---|
| **Edition** | `local`, `cloud`, or `demo` — set via `NEXT_PUBLIC_WWV_EDITION`. Drives auth/storage/tenant adapters |
| **Bridge API** | Routes in WWV (`/api/marketplace/*`) that the marketplace calls to install/manage plugins |
| **Setup Wizard** | First-run config UI — app-level (Cesium token) and plugin-level (plugin API keys) |
| **Runtime Settings Store** | `settings` DB table — replaces `.env` for everything user-facing |
| **RLS** | Row-Level Security — PostgreSQL feature enforcing tenant data isolation at the DB level |
| **Snapshot Capture** | WWV periodically stores plugin data per tenant for history/timeline. Pro/Local only |
| **Trust Stamping** | WWV always overwrites `manifest.trust` server-side — no client claims are accepted |
| **NpmCache** | DB table caching NPM registry metadata to decouple from live NPM polling |

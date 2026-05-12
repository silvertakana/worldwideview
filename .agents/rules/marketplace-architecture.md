---
trigger: model_decision
description: Guidelines for the WorldwideView plugin marketplace, database interactions, and dynamic plugin installation.
---

# Marketplace Architecture

## 1. InstalledPluginsLoader
Marketplace plugins are dynamically loaded via `InstalledPluginsLoader`. At startup, this service queries the PostgreSQL database (`installed_plugins` table) for dynamically installed manifests.

## 2. Dynamic Bundle Loading
Plugins from the marketplace use the `bundle` format and are imported at runtime from CDN endpoints (e.g., unpkg) via `loadPluginFromManifest()`.

## 3. Database Sync
- Marketplace installations mutate the Prisma database.
- `pluginManager.loadFromManifest()` validates and registers these plugins.
- Ensure any schema changes to the marketplace tables follow the `database-migrations.md` rule.

## Current Implementation State


- **Stage 4 (Bridge API + One-Click Install)** ✅ COMPLETE
- Plugin data currently served from a volume-backed **PostgreSQL database** — plugins are submitted by entering an NPM package name in the Admin UI
- The marketplace auto-fetches metadata from the NPM registry and parses the `"worldwideview"` block in `package.json`
- A background `NpmCache` table caches NPM registry metadata to decouple from live NPM dependency
- Future: Supabase DB for full publisher workflow (Stage 5)

---

## Plugin Submission Flow (Current)

1. Developer publishes their plugin to npm with a `"worldwideview"` block in `package.json`
2. Admin opens the Marketplace Admin UI
3. Admin enters the npm package name (e.g. `@worldwideview/wwv-plugin-my-data`)
4. Marketplace fetches metadata from NPM registry, parses the manifest block, stores in PostgreSQL DB
5. Plugin appears in the browse catalog

> Static plugins still need their GeoJSON files placed in the host application's `public/data/` directory.

---

## One-Click Install Flow (Redirect-Based)

**No static API keys.** Auth is entirely session-based. The marketplace redirects the browser to WWV, which checks the user's existing login session.

```
User clicks "Install" on marketplace
  ↓
Marketplace: check localStorage for instance URL
  ↓ (if not configured)
Show "Connect Your Instance" modal → user enters http://localhost:3000
  ↓
MP → GET /api/marketplace/grant-token?redirectTo=...
  ↓
WWV: check Auth.js session → issue 30-day JWT → redirect ?token=<jwt>
  ↓
MP stores JWT in localStorage
  ↓
MP: Navigate browser to /api/marketplace/install-redirect
  ?pluginId=borders&manifest=<b64>&redirectTo=...
  ↓
WWV: check session → upsertPlugin() → issueMarketplaceToken()
  ↓
Redirect back ?installed=borders&token=<jwt>
  ↓
MP: Show ✓ Installed — store JWT for future Manage-page calls
```

### Token Flow

After successful install, WWV issues a **30-day HS256 JWT** (`scope: "marketplace"`, signed with `AUTH_SECRET`). The marketplace stores it in `localStorage` and sends it as `Authorization: Bearer <token>` on all subsequent API calls.

`validateMarketplaceAuth` accepts auth in priority order:
1. Active Auth.js session (same-origin browser)
2. Marketplace JWT Bearer token (cross-origin Manage page)
3. Legacy static `WWV_BRIDGE_TOKEN` (backward compat)

---

## WWV Bridge API Routes (Implemented)

| Route | Method | Purpose |
|---|---|---|
| `/api/marketplace/install-redirect` | GET | Browser redirect install — checks session, installs plugin, issues JWT |
| `/api/marketplace/grant-token` | GET | Issues marketplace JWT without install (for Manage page) |
| `/api/marketplace/status` | GET | Returns all installed plugins (session or JWT auth) |
| `/api/marketplace/uninstall` | POST | Deletes an installed plugin record |
| `/api/marketplace/load` | GET | Returns valid non-built-in manifests for client startup (no auth) |
| `/api/auth/setup-status` | GET | CORS-enabled connection test endpoint |

### Auth Module: `src/lib/marketplace/`

| File | Purpose |
|---|---|
| `auth.ts` | `validateMarketplaceAuth()` — session → JWT → legacy token |
| `marketplaceToken.ts` | `issueMarketplaceToken()` / `verifyMarketplaceToken()` — HS256 JWT via jose |
| `cors.ts` | CORS headers for marketplace bridge routes |
| `repository.ts` | `upsertPlugin()`, `uninstallPlugin()`, `getInstalledPlugins()` |
| `registryClient.ts` | Fetches and Ed25519-verifies the signed plugin registry. 5-min in-memory cache. Stamps trust at install time |
| `trustedPlugins.ts` | `localStorage` helpers for tracking user-approved unverified plugins |

---

## Marketplace API Endpoints (Target State)

### Public
| Method | Path | Description |
|---|---|---|
| GET | `/api/plugins` | List/search plugins |
| GET | `/api/plugins/:id` | Plugin detail |
| GET | `/api/plugins/:id/bundle` | Download plugin bundle |
| GET | `/api/categories` | List categories |
| GET | `/api/registry` | Ed25519-signed verified-plugins registry — fetched by WWV at install time |

### Authenticated (Consumer)
| Method | Path | Description |
|---|---|---|
| POST | `/api/instances` | Register a WWV instance |
| PUT | `/api/instances/:id/default` | Set default instance |
| POST | `/api/plugins/:id/install` | Trigger install to default instance |
| GET | `/api/me/plugins` | List user's installed plugins |

### Authenticated (Publisher)
| Method | Path | Description |
|---|---|---|
| POST | `/api/publisher/plugins` | Submit a new plugin |
| PUT | `/api/publisher/plugins/:id` | Update plugin |
| POST | `/api/publisher/plugins/:id/versions` | Publish new version |
| GET | `/api/publisher/analytics` | Publisher analytics |

---

## Data Model

### WWV Local DB (Prisma — current)

```prisma
model InstalledPlugin {
  id          String   @id @default(uuid())
  pluginId    String
  version     String
  config      String   // Full manifest JSON
  installedAt DateTime @default(now())
}

model NpmCache {
  id          String   @id @default(uuid())
  packageName String   @unique
  metadata    String   // JSON — cached NPM registry response
  lastFetched DateTime @default(now())
}
```

### Marketplace DB (Supabase — target, Stage 5+)

```
users ─── published_plugins ─── plugin_versions
                │
              reviews
```

Key fields on `published_plugins`: `slug`, `publisher_namespace` (`publisher.plugin-name`), `status` (`draft | review | published | rejected`), `manifest` (jsonb).

### Cloud DB (Supabase PostgreSQL — RLS-scoped)

```
tenants ─── installed_plugins
        └── settings
```

---

## Security

| Concern | Mitigation |
|---|---|
| No static API keys | Install flow uses session redirects — no token to leak |
| Marketplace JWT | 30-day HS256, scope-locked, verified via `jose` |
| CSRF | Install/grant-token are GET redirects — user explicitly navigates |
| Open redirect | `redirectTo` validated against allowlist |
| Manifest tampering | Base64 only — no code execution. Validated via `validateManifest()` |
| Malicious plugins | Sandboxed in Web Workers (unverified). CSP headers. Code review (verified) |
| Supply chain | Plugin bundles checksummed (SHA-256), integrity verified |
| Plugin API keys | Stored encrypted in `settings` table, never exposed to browser |
| Trust forgery | Registry signed with Ed25519 — `verified` cannot be claimed for unlisted plugins |
| Trust stamping | WWV always overwrites `manifest.trust` server-side — client/marketplace input ignored |
| Unverified consent | Warning dialog before any unverified plugin loads; approval stored per-plugin in `localStorage` |

---

## API Key Proxy & Rate Limiting (For `apikey` plugins)

Response caching makes server-as-proxy viable at scale:

```
1000 users viewing earthquake plugin:
→ 1000 requests hit your proxy
→ Proxy: "I fetched this URL 3s ago, cache still valid"
→ Returns cached response to all 1000
→ 1 actual upstream request to USGS
```

| Tier | Proxy req/min | Cache TTL |
|---|---|---|
| Free | 60 | 30s |
| Pro | 300 | 10s |
| Enterprise | Unlimited | 5s |

---

## History & Timeline

**Third-party history (`historyUrl`):** Plugin manifest declares a history URL with `%t` placeholder. WWV replaces it with the scrubber timestamp — third-party provides the endpoint. No storage on your side. Available on all tiers.

**WWV Snapshot Capture:** Your server periodically stores plugin data per tenant. Counts toward storage quota. Pro/Local only.

| Feature | Free (cloud) | Pro / Local |
|---|---|---|
| Live data (declarative `url`) | ✅ | ✅ |
| Third-party history (`historyUrl`) | ✅ If supported by API | ✅ |
| WWV snapshot capture | ❌ | ✅ Counts toward quota |
| Built-in aviation/maritime history | ✅ Limited (24h) | ✅ Full |

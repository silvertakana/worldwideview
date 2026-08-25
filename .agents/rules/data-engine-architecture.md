---
description: Architecture rules and dependency management guidelines for wwv-data-engine seeders, pnpm workspace dependency loading, and WebSocket payload contracts.
paths:
  - "packages/**/*"
  - "docker-compose.yml"
---

# Data Engine V2 Architecture & Dependency Loading

## 1. Engine Versions: V2 vs Legacy
The current and only active engine is **`wwv-data-engine-v2`**.
- **Legacy Engine**: Previously, data sources ran as isolated, standalone microservices running their own Node environments.
- **V2 Engine**: Acts as a unified **"Host Environment" runner**. It is a single Node.js process that dynamically downloads and executes multiple independent seeder bundles (both public community seeders and private seeders).

## 2. Deployment Architecture
- **Single Docker Image**: V2 is deployed via Coolify as a single Docker image, natively mapping environment variables continuously into the container shell.
- **Automated Restarts**: Code pushes to the `wwv-data-engine-public` repository automatically trigger a service restart via a secure `COOLIFY_API_TOKEN` configured in the CI/CD pipeline (replacing unreliable generic webhooks).
- **Dual-Output Engine**: Seeders in V2 expose both a WebSocket stream (`/stream`) for real-time instantaneous updates, and a REST API endpoint (`/api/:id`) for fetching live data snapshots directly from Redis.

## 3. Pnpm Workspaces & Dynamic Dependency Loading
To prevent seeders from ballooning in size by bundling a massive amount of dependencies, the system heavily relies on `pnpm` workspaces.
- **Host Environment**: The V2 engine natively provides common geospatial and utility packages (e.g., `zod`, `ws`, `node-cron`, `undici`, `satellite.js`, `geoip-lite`). Seeders **MUST NOT** bundle these standard dependencies, and should leave them external in `tsup`.
- **Dynamic Workspaces**: When V2 loads a compiled `dist/index.mjs` via `node`, it dynamically resolves imports by traversing up to the workspace `node_modules`.

## 4. Production Deployment & Downloader
In production, the `wwv-data-engine-v2` does NOT mount the local file system. Instead:
1. `download-seeders.ts` runs on container startup.
2. It fetches the latest compiled `seeders.zip` from GitHub Releases for both community and private repositories.
3. **CRITICAL STEP:** After unzipping the workspaces into a staging directory (`/app/seeders`), the script dynamically generates a root `package.json` and `pnpm-workspace.yaml`.
4. It then runs a single **workspace-aware `pnpm install --prod`**. This ensures all custom unbundled dependencies declared by the extracted plugins are downloaded directly into the container and properly linked together.
## 5. Namespace Separation Rule

To prevent collisions and `404` or `ERR_MODULE_NOT_FOUND` errors, seeders **MUST NOT** exist simultaneously in both the community (`wwv-seeders`, cloned to a `local-seeders/community/` directory when developing locally; these are nested git clones created by worktree hooks, not tracked in the main repo) and private (`wwv-seeders-private`, cloned to `local-seeders/private/` the same way) repositories. Namespace overlaps will cause module resolution failures when the V2 engine attempts to load them. Private seeders have priority.

## 6. Plugin ID Contract — Single Source of Truth

> **See ADR-0002** (`docs/architecture/decisions/adr-0002-seeder-exported-name-as-canonical-plugin-id.md`) for full rationale and alternatives considered.

**Rule:** Every seeder MUST export a `name` field that exactly matches the corresponding frontend plugin's `id` field (kebab-case).

```typescript
// ✅ Correct — seeder src/index.ts
export default {
  name: "gps-jamming",   // MUST equal the frontend plugin id
  cron: "0 0 * * *",
  fn: seedGpsJam,
};

// ❌ Wrong — do not use folder names, camelCase, or abbreviations
export default {
  name: "gpsjam",        // mismatch — frontend plugin is "gps-jamming"
  ...
};
```

**How the engine uses it:** `seeder-loader.ts` reads each seeder's exported `name` as the canonical plugin ID. This ID is used for:
- The `/manifest` endpoint's `plugins` array (what the frontend checks for local routing)
- WebSocket data messages (`pluginId` field)
- Redis keys (`data:<name>:live`)
- Scheduler logs

**Folder names are organizational only.** The engine warns at startup if `toKebabCase(folderName) !== seeder.name`, but this is cosmetic — the seeder's exported `name` always wins. Folder renames are a future cleanup, not a functional requirement.

**Frontend side:** `resolveEngineUrl(pluginId)` checks `localEngineHasPlugin(pluginId)` against the manifest. If the names match, the plugin routes to `ws://localhost:5000/stream`. No alias maps or translation layers are needed.

## 7. WebSocket Payload Format Contract

When a seeder calls `setLiveSnapshot(pluginId, payload, ttl)`, the engine broadcasts:
```json
{ "type": "data", "pluginId": "my-plugin", "payload": <whatever you passed> }
```

**`WsClient` payload handling rules (in order):**

1. Plugin has `mapWebsocketPayload(payload, existingEntities)` → called with raw payload → must return `GeoEntity[]`
2. No handler + payload **is** a flat `GeoEntity[]` array → used directly (timestamp normalized)
3. No handler + payload is **any other object** → **silently dropped** with a console warning

This means:

| Seeder sends | Frontend needs | Notes |
|---|---|---|
| `[{id, latitude, longitude, ...}]` | Nothing (WsClient handles) | ✅ Simplest for basic point data |
| `{ items: [{...}] }` | `mapWebsocketPayload` | Standard engine snapshot format |
| `{ satellites: [{...}] }` | `mapWebsocketPayload` | Named-collection format |

**Recommendation:** If the seeder and frontend plugin are developed together, use a **flat `GeoEntity[]` array** — no `mapWebsocketPayload` needed. Use named objects (e.g. `{ satellites: [...] }`) only when the seeder data has a domain-specific shape worth preserving; in that case you **must** implement `mapWebsocketPayload` on the frontend plugin.

> [!CAUTION]
> The most common silent bug: seeder sends `{ items: [...] }` (an object), frontend plugin omits `mapWebsocketPayload`. Data arrives but WsClient drops it with a console warning. The globe stays empty. Always implement `mapWebsocketPayload` for any plugin whose seeder sends an object payload.

## 8. Seeder Authoring Contract — the module shape

§7 covers what a seeder **sends**. This covers how you **write** one. The engine
auto-discovers a seeder by scanning `SEEDERS_DIR` for any folder with
`dist/index.mjs` and importing its **default export**. The seeder's `id` is the
**folder name**, not the `name` field. You never call a register function — the
authoritative reference is `wwv-data-engine/README.md` → "Authoring a Seeder".

The default export is `{ name }` plus **one** of these shapes:

| Shape | You provide | How data is published |
|---|---|---|
| `interval` + `fetch(ctx)` | `fetch` **returns** the array | scheduler wraps + stores + broadcasts it for you |
| `cron` + `fn(ctx)` | `fn` publishes itself | `import { setLiveSnapshot } from '@worldwideview/seeder-sdk'` and call it |
| `init(ctx)` | a persistent listener | publish via the SDK as push data arrives |

**The trap (this caused a real, silent CI failure):** `ctx` is **only `{ redis }`**.
There is no `ctx.setLiveSnapshot`. Reaching for it throws at runtime and the
snapshot never lands. Publish helpers come from `@worldwideview/seeder-sdk`, not
from `ctx`. The engine now types `ctx` as `SeederContext { redis }`, so this is a
compile error for any typed seeder — but `.mjs` seeders without type-checking get
no such safety net, so know the contract.

<bad-example>
```ts
// cron + fn reaching for a method that does not exist on ctx
export default {
  name: "earthquakes",
  cron: "0 * * * *",
  fn: async (ctx) => {
    await ctx.setLiveSnapshot("earthquakes", items, 3600); // ❌ not a function — dies silently
  },
};
```
</bad-example>

<good-example>
```ts
// Option A — cron + fn: publish via the SDK (dominant idiom)
import { setLiveSnapshot } from "@worldwideview/seeder-sdk";
export default {
  name: "earthquakes",
  cron: "0 * * * *",
  fn: async () => {
    await setLiveSnapshot("earthquakes", { source: "earthquakes", fetchedAt: new Date().toISOString(), items, totalCount: items.length }, 3600);
  },
};

// Option B — interval + fetch: just return the array, scheduler does the rest
export default {
  name: "earthquakes",
  interval: 60_000,
  fetch: async () => items, // ✅ no publishing call needed
};
```
</good-example>

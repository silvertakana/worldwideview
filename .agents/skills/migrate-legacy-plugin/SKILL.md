---
name: migrate-legacy-plugin
description: Use when moving a WorldWideView plugin from packages/ (or ../worldwideview-plugins/packages/) to local-plugins/, converting legacy plugins to the new Engine & Payload architecture, or when a plugin hardcodes engine URLs, bundles Node.js built-ins, or uses import.meta.url for file paths inside Docker containers
---

# Migrate Legacy Plugin to Modern Architecture

## Overview

Moves a WorldWideView plugin from the old `packages/` monorepo location (or the external `worldwideview-plugins` repository) into the `local-plugins/` directory (which is itself a publishable Git repository). Simultaneously fixes two **independent** concerns that legacy plugins always have:

1. **Frontend routing** — hardcoded engine URLs must be replaced with `resolveEngineUrl()`
2. **Backend seeder build** — ESM bundling and container-aware file paths

**Core principle:** These are two separate problems in two separate codebases. Never fix one and forget the other.

## When to Use

- Moving a plugin from `packages/wwv-plugin-<name>/` (or `../worldwideview-plugins/packages/wwv-plugin-<name>/`) to `local-plugins/wwv-plugin-<name>/`
- Plugin's `fetch()` hardcodes a URL like `https://dataengine.worldwideview.dev`
- Plugin uses `this.context?.apiBaseUrl` instead of `resolveEngineUrl()`
- Backend seeder crashes with `Dynamic require` or `ERR_INVALID_FILE_URL_PATH` in Docker
- Seeder uses `fileURLToPath(import.meta.url)` for locating seed data files
- Plugin builds with `tsc` instead of `tsup`/`vite`

**Do NOT use for:**
- Creating a brand-new plugin from scratch → use `worldwideview-plugin-creation` skill
- Modifying rendering or Cesium primitives → see `cesium-rendering` rule
- Debugging state management → see `state-management` rule

## The Two Independent Concerns

> [!TIP]
> **Automated Migration Script**
> A new automation script is available! Before doing this manually, simply run:
> ```bash
> node scripts/migrate-plugin.mjs <plugin-name>
> ```
> Example: `node scripts/migrate-plugin.mjs gps-jamming`
> 
> The script will automatically copy the frontend plugin, inject peerDependencies, refactor `index.tsx` routing, and fix the backend seeder's build settings and `SEEDERS_DIR` paths. (Fresh-install seeding no longer involves a hard-coded list — once published to npm with a valid `worldwideview` block, the plugin is registered via the signed verified registry.)
> **You still need to run `pnpm install` and verify the builds manually as described below.**

> [!IMPORTANT]
> Legacy plugins always have BOTH of these problems. They are independent — you can fix one without the other, but you MUST fix both. Do not get tunnel-visioned into only fixing one.

| Concern | Where | Symptom | Fix |
|---|---|---|---|
| **Frontend routing** | `local-plugins/wwv-plugin-<name>/src/index.ts` | Plugin always hits cloud engine, ignores local dev engine | Use `context.getEngineUrl()` |
| **Backend build** | `local-seeders/<namespace>/packages/<name>/` | Container crashes on startup with ESM errors | `tsup --format esm --target es2022`, use `SEEDERS_DIR` |

---

## Step 1: Move the Plugin Directory

Copy the plugin from `packages/` (or the external plugins repo) to `local-plugins/`:

```bash
# From project root (if in local packages/)
cp -r packages/wwv-plugin-<name> local-plugins/wwv-plugin-<name>

# OR from external plugins repository:
cp -r ../worldwideview-plugins/packages/wwv-plugin-<name> local-plugins/wwv-plugin-<name>
```

The `local-plugins/` directory is:
- Part of the pnpm workspace (`pnpm-workspace.yaml` includes `local-plugins/*`)
- Gitignored from the main worldwideview repo (it IS its own Git repo — `worldwideview-plugins`)
- Auto-discovered by the `dev:plugins` watcher during `pnpm dev`

## Step 2: Fix Frontend Routing (getEngineUrl)

This is the fix that gets missed most often. Legacy plugins typically hardcode their engine URL or use messy dynamic imports.

```typescript
// ❌ LEGACY — always hits cloud, ignores local engine
const baseUrl = this.context?.apiBaseUrl || "https://dataengine.worldwideview.dev";
const res = await fetch(`${baseUrl}/api/myplugin`);

// ❌ BAD (Previous Workaround) — creates bundling chunks and causes 404s
const { resolveEngineUrl } = await import("@/core/data/resolveEngineUrl");
const wsUrl = resolveEngineUrl(this.id);
const engineBase = wsUrl.replace(/^ws/, 'http').replace(/\/stream$/, '');
const res = await fetch(`${engineBase}/api/myplugin`);
```

The correct approach uses `this.context.getEngineUrl()` provided by the Host when the plugin is initialized. The Host automatically handles checking `localhost:5000/manifest`, applying `getServerConfig().streamUrl`, reading `plugin.json`, or falling back to the cloud.

```typescript
// ✅ MODERN — resolves local-first, respects split-routing, clean code
async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
    try {
        const engineBase = this.context!.getEngineUrl();
        const res = await globalThis.fetch(`${engineBase}/api/${this.id}`);
        if (!res.ok) throw new Error(`Backend returned ${res.status}`);

        const data = await res.json();
        return this.mapPayloadToEntities(data);
    } catch (err) {
        console.error(`[${this.id}] Fetch error:`, err);
        return [];
    }
}
```

If the plugin is WebSocket-only (`getPollingInterval()` returns 0 and `fetch()` returns `[]`), the frontend routing is handled automatically by `DataBusSubscriber` and `WsClient`. No changes needed to the plugin class — but verify the seeder ID matches.

### Why This Matters

Without this fix, running `pnpm dev:all` starts a local engine at `localhost:5000` with your seeder, but the frontend plugin ignores it and hits the cloud. You'll see stale or missing data and waste time debugging the wrong layer.

## Step 3: Update package.json

Ensure the plugin's `package.json` follows the modern format:

```json
{
  "name": "@worldwideview/wwv-plugin-<name>",
  "version": "1.0.0",
  "main": "dist/frontend.mjs",
  "types": "src/index.ts",
  "type": "module",
  "module": "dist/frontend.mjs",
  "files": ["src"],
  "worldwideview": {
    "id": "<name>",
    "icon": "IconName",
    "category": "category-name",
    "format": "bundle",
    "capabilities": ["layer"]
  },
  "peerDependencies": {
    "@worldwideview/wwv-plugin-sdk": "^1.4.10"
  },
  "scripts": {
    "build": "vite build"
  }
}
```

Key differences from legacy:
- `"main"` points to `dist/frontend.mjs` (not `src/index.ts`)
- Has `"type": "module"` and `"module"` field
- Uses `peerDependencies` (not `dependencies`) for SDK
- Uses `"workspace:*"` only for libraries that must be linked locally (e.g., `wwv-lib-incidents`)

## Step 4: Ensure Vite Build Config

Every `local-plugins/` plugin needs this `vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import { wwvPluginGlobals } from "@worldwideview/wwv-plugin-sdk";

export default defineConfig({
  plugins: [wwvPluginGlobals()],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "frontend.mjs",
    },
    minify: true,
    sourcemap: false,
  },
});
```

`wwvPluginGlobals()` externalizes React, Cesium, Resium, zustand, and the SDK so the plugin doesn't bundle its own copies.

## Step 5: Fix Backend Seeder (if applicable)

If the plugin has a corresponding seeder in `local-seeders/`, fix two things:

### 5a. ESM Build

Legacy seeders built with `tsc` or bundled Node built-ins. Fix:

```json
"scripts": {
  "build": "tsup src/index.ts --format esm --target es2022 --clean"
}
```

This produces clean ESM that the data engine can `import()` without `Dynamic require` errors.

### 5b. Container-Aware File Paths

Legacy seeders used `fileURLToPath(import.meta.url)` to locate seed data. This breaks inside Docker because the transpiled path doesn't match the container filesystem.

```typescript
// ❌ LEGACY — breaks in Docker container
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "data", "seed.json");

// ✅ MODERN — works everywhere
const dataPath = process.env.SEEDERS_DIR
  ? path.join(process.env.SEEDERS_DIR, "community", "packages", "<name>", "data", "seed.json")
  : path.resolve(process.cwd(), "data", "seed.json");
```

`SEEDERS_DIR` is set by the Docker container to `/app/seeders`. When running locally outside Docker, the fallback uses `process.cwd()`.

### 5c. Seeder Directory Naming

The folder name inside `local-seeders/community/packages/` or `local-seeders/private/packages/` **must exactly match** the plugin's string ID (`this.id` in `index.tsx`).

The `wwv-data-engine`'s auto-discovery logic (`seeder-loader.ts`) derives the internal plugin ID from the directory name. If the folder is named `gpsjam` but the frontend plugin expects `gps-jamming`, the frontend will not find it in the `/manifest` and will silently fall back to the cloud engine, breaking local testing.

```bash
# ❌ INCORRECT (Frontend expects "gps-jamming")
local-seeders/community/packages/gpsjam/

# ✅ CORRECT
local-seeders/community/packages/gps-jamming/
```

## Step 6: Clean Up packages/ References

After moving to `local-plugins/`, remove the old references:

- [ ] Delete `packages/wwv-plugin-<name>/` directory (or the source directory in `../worldwideview-plugins/packages/`)
- [ ] Remove from `transpilePackages` in `next.config.ts` (if present)
- [ ] Remove path alias from `tsconfig.json` `paths` (if present)
- [ ] Remove any registration in `AppShell.tsx` (now loaded dynamically)
- [ ] Run `pnpm install` from project root

## Step 7: Verify

```bash
# 1. Start everything
pnpm dev:all

# 2. Check engine discovered the seeder (if applicable)
curl http://localhost:5000/manifest
# Should include your plugin ID

# 3. Check frontend console — should show:
# [EngineManifest] Local engine detected: N seeders ["your-plugin", ...]
# NOT: fetching from https://dataengine.worldwideview.dev

# 4. Toggle the layer on the globe — entities should render
```

## Migration Checklist

- [ ] Plugin copied from `packages/` (or external repo) to `local-plugins/`
- [ ] Frontend `fetch()` uses `this.context.getEngineUrl()` (not hardcoded URLs or dynamic imports)
- [ ] `package.json` has `"type": "module"`, `"main": "dist/frontend.mjs"`
- [ ] `vite.config.ts` uses `wwvPluginGlobals()` externalization
- [ ] Backend seeder builds with `tsup --format esm --target es2022` (if applicable)
- [ ] Backend seeder uses `process.env.SEEDERS_DIR` for file paths (if applicable)
- [ ] Old source directory deleted
- [ ] Old `transpilePackages`/`tsconfig paths` entries removed
- [ ] `pnpm install` run from root
- [ ] `pnpm dev:all` → local engine detected → data renders on globe

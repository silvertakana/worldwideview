---
trigger: model_decision
description: The standard operating procedure for instantiating, modifying, and registering a new data source plugin within the engine.
---

# Plugin Architecture & Data Flow

## Purpose
The standard operating procedure for instantiating, modifying, and registering a new data source plugin within the engine.

## The WorldPlugin Contract

All data ingest flows through `WorldPlugin` (defined entirely within `@worldwideview/wwv-plugin-sdk`).
A valid plugin class MUST provide:
1. `id` and `version` (The `version` MUST be dynamically imported via `import pkg from "../package.json"` to prevent duplicate tracking during CI/releases for built-in plugins).
2. `fetch(timeRange)` method logic.
3. `renderEntity(GeoEntity)` to determine visual style.
4. `getPollingInterval()` (defaults fallback securely to standard store config).

## Plugin Architectures (Manifest Formats)

Plugins are defined via `PluginManifest` and operate on an **All-Bundle** architecture.
All frontend extensions must eventually be compiled into a JS bundle that exports a `WorldPlugin`.

1. **`bundle` (Dynamic CDN Loaded / Internal)**: Plugins dynamically imported at runtime via ES module references (e.g., `unpkg.com` or local `/plugins/myplugin/frontend.mjs`). Handled by `loadPluginFromManifest` referencing `manifest.entry`.
2. **`static` (Legacy)**: Now compiled via `wwvStaticCompiler` into a dynamic bundle. The raw `StaticDataPlugin` runtime class has been removed.
3. **`declarative` (Legacy)**: Now compiled or wrapped into bundles.

No matter the source, the engine evaluates it by directly loading the `entry` file dynamically:
`const module = await import(/* webpackIgnore: true */ entry);`

## Package Metadata (`package.json`)

All plugins MUST define their identity and compatibility via a `"worldwideview"` block in their `package.json`. This acts as the source-of-truth for generating the `PluginManifest` for the registry. If a plugin does not define `"type"`, validation functions will reject the manifest entirely or rely on legacy fallbacks.

```json
{
  "name": "@worldwideview/wwv-plugin-myplugin",
  "version": "1.0.0",
  "worldwideview": {
    "id": "myplugin",                      // REQUIRED: Must match the directory name & API routes.
    "type": "data-layer",                  // REQUIRED: "data-layer" or "extension"
    "format": "bundle",                    // REQUIRED: "bundle", "declarative", or "static"
    "category": "Aviation",                // REQUIRED: Matches PluginCategory union in SDK
    "icon": "Plane",                       // RECOMMENDED: Lucide icon name
    "capabilities": [                      // REQUIRED: What the plugin can do
      "data:own",                          // (e.g. injects its own data)
      "globe:overlay",                     // (e.g. renders 3D elements)
      "network:fetch"
    ]
  }
}
```

## The Registration Pipeline

> [!NOTE]
> All plugin interactions run through three singleton services:
> `PluginRegistry` / `InstalledPluginsLoader` -> `PluginManager` -> `PollingManager` -> `DataBus`

### `InstalledPluginsLoader`
Scans the PostgreSQL database at startup for dynamically installed marketplace manifests. Parses, validates (`validateManifest`), and registers valid plugins via `pluginManager.loadFromManifest`.

### `PluginManager`
The orchestrator. Exposes `registerPlugin`, `enablePlugin`, `disablePlugin`. Never bypass the manager to push data manually to the cache. Supports dynamic loading via `loadFromManifest`.

### `PollingManager`
Coordinates interval execution. Implements **exponential backoff**. When a plugin errors, it retries at increasing scales (e.g., 2s → 4s → 8s) automatically. 

### `DataBus`
The typed generic event bus separating React UI components from background execution. 

```typescript
// How data gets pushed onto the rendering surface securely:
DataBus.getInstance().emit('dataUpdated', { 
    pluginId: "mytracker", 
    entities: newEntities 
});
```

## Local Plugin Development (Sandbox)

To rapidly iterate on plugins without polluting the core monorepo `packages/` directory or git history, use the local devkit:

1. **Create**: Run `node packages/wwv-cli/dist/index.js create <name> --local` to scaffold a full plugin structure inside the `local-plugins/` directory.
2. **Develop**: Running `pnpm dev` or `pnpm dev:all` automatically spawns the `dev:plugins` watcher. Any changes made to plugins in `local-plugins/` will be instantly rebuilt using Vite (externalizing large globals) and synced to `public/plugins-local/` for hot-reloading.
3. **Promote**: Once the plugin is stable and ready to be committed or published, run `node packages/wwv-cli/dist/index.js link <name>` to automatically move it to `packages/` and clean up the sandbox.

## When to Apply
When writing `fetch` implementations for plugins, or tracing why an entity dropped off the map. Ensure missing data correctly triggers the cache fallback via the DataBus. Ensure all new external plugins use the `bundle` format and exist in the marketplace registry to avoid CDN 404 hydrating crashes.



## Capability Declarations


Every plugin declares what it can access. Undeclared capabilities are **blocked at runtime**.

```typescript
type PluginCapability =
  | "data:own"          // Fetch and render its own data layer
  | "data:read:<id>"    // Read entities from another plugin
  | "ui:detail-panel"   // Inject UI into entity detail panel
  | "ui:sidebar"        // Add a sidebar section
  | "ui:toolbar"        // Add toolbar buttons
  | "ui:settings"       // Add a settings page
  | "globe:overlay"     // Draw on the globe (polylines, polygons, heatmaps)
  | "globe:camera"      // Control camera movement
  | "storage:read"      // Read from local/cloud storage
  | "storage:write"     // Write to local/cloud storage
  | "network:fetch"     // Make external HTTP requests
```

---

## Trust Tiers

| Trust Tier | Who | Capabilities Allowed | How Determined |
|---|---|---|---|
| **Built-in** | Ships with WWV | All | Hardcoded in `AppShell` at build time |
| **Verified** | WorldWideView-reviewed | Any declared capability | Plugin ID in the **signed registry** |
| **Unverified** | Community / 3rd-party | `data:own`, `ui:settings` only | Plugin ID NOT in the registry |

### Signed Plugin Registry

Trust is determined by a cryptographically signed JSON file:

```
GET marketplace.worldwideview.dev/api/registry
→ { plugins: ["aviation", "maritime", ...], issuedAt, signature }
```

- Signed with **Ed25519** private key (held only by registry maintainer)
- WWV instances have the **public key hardcoded** — nobody can forge a fake verified list
- WWV fetches and **verifies signature server-side** at install time
- Trust is **always stamped server-side** — no client-side trust claims accepted
- Registry response cached for **5 minutes** (in-memory on each WWV instance)
- If registry unreachable, last cached result used; new unknowns default to `unverified`
- **Managing:** Edit `src/data/verifiedPlugins.ts` in marketplace repo and redeploy
- **Revoking:** Remove plugin ID and redeploy — WWV instances drop trust on next cache refresh

### Unverified Plugin Warning

When an unverified manifest is encountered:
1. Plugin held in pending queue (not loaded)
2. `UnverifiedPluginDialog` shown: "This plugin is unverified. Install at your own risk."
3. User can Allow (stores approval in `localStorage`) or Deny
4. Once approved, dialog won't reappear for that plugin ID

---

## VS Code Design Patterns Applied

**Activation events** — plugins declare when they activate, not at startup:
```json
"activationEvents": ["onView:aviationLayer", "onCommand:wwv.showCockpit"]
```

**Contribution points** — declarative UI, no code needed for sidebar/menu entries:
```json
"contributes": {
  "commands": [{ "command": "wwv.enterCockpit", "title": "Enter Cockpit View" }],
  "settings": [{ "key": "refreshInterval", "type": "number", "default": 10 }]
}
```

**Extension dependencies** — plugins can require other plugins (auto-installed if missing):
```json
"extensionDependencies": ["worldwideview.aviation"]
```

**Publisher namespaces** — `publisher.plugin-name` (e.g., `silvertakana.aviation`). Prevents naming conflicts.

**Extension packs** — bundles of related plugins:
```json
{ "id": "worldwideview.military-suite", "extensionPack": ["aviation", "military-bases", "radar-overlay"] }
```

---

## Plugin Auth Types

Plugins declare auth type in the manifest:

| Auth Type | Who Calls the API | Server Role |
|---|---|---|
| `none` | Browser, directly | Nothing |
| `apikey` | Server proxy | Injects key from DB, caches response |
| `token-exchange` | Browser, directly (after exchange) | One-time key→token swap |
| `oauth` | Browser, directly (after OAuth) | OAuth callback handler, stores token |

**Recommended for scale:** `token-exchange` — your server is never in the hot path for data requests.

---

## Plugin Development Workflows

Starting in 2026, WorldWideView adopted the **Architect and Toolbox** paradigm using NPM global tools, ensuring a fully decoupled developer experience. Plugin repositories contain *pure code* with absolutely no platform hosting boilerplate (e.g. no embedded docker-compose files).

### The Developer Experience
1. **Scaffold**: `node packages/wwv-cli/dist/index.js create <name> --local` (Creates sandbox inside `local-plugins/`)
2. **Install**: `pnpm install` (Links dependencies via workspace)
3. **Develop**: `pnpm dev:all` (Starts frontend, data engine, and plugin watcher dynamically)

### Local vs Docker Development
The marketplace API natively supports hot-reloading for local plugins without rebuilding the core.

**Docker-Hosted Mode (Recommended for external devs):**
If a developer wants to build a plugin without cloning the 1GB+ WorldWideView monorepo, they can pull the official WWV Docker image and mount their compiled plugin code:
1. Run WWV with the development flag: `WWV_PLUGIN_DEV=true`
2. Mount the local plugin's `dist/` folder into the container's `/app/local-plugins/` directory.
3. Because the plugin is strictly code, Vite rebuilds in <100ms, and a browser refresh instantly loads the new plugin from the Docker volume.

**Core Contributor Mode:**
If working inside a cloned `worldwideview` directory, scaffolding the plugin into `local-plugins/` makes it a pnpm workspace member. Running `pnpm dev:all` automatically spawns `pnpm dev:plugins`, which continuously transpiles local plugins so the Next.js frontend can hot-reload them without complex linking.

---

DB stores **references only** — never plugin files:

```prisma
model InstalledPlugin {
  pluginId    String
  version     String
  manifestUrl String  // "https://marketplace.../api/plugins/aviation/manifest"
  bundleUrl   String? // local path or CDN URL (differs by edition)
}
```

| Edition | `bundleUrl` | How served |
|---|---|---|
| **Local** | `file:./plugins/cockpit-view/bundle.js` | Local filesystem (downloaded at install) |
| **Cloud** | `https://cdn.worldwideview.dev/plugins/cockpit-view/bundle.js` | CDN at runtime |

---

## Environment Variables & Execution Agnosticism

WWV enforces a strictly decoupled execution context, allowing plugins to function reliably whether they are loading locally (`plugins-local`) or from a public CDN (`unpkg.com`).

### Dynamic Assets (`import.meta.url`)
For file-based assets bundled alongside the plugin (such as JSON datasets or 3D GLTF models), the runtime relies on native ECMAScript relative resolution instead of hardcoded framework paths.
- Plugins securely fetch their assets using `new URL('data/data.json', import.meta.url).href`.
- **Impact:** Assets resolve properly directly from the domain they were executed on. No CORS bypasses or CDN fallbacks required.

### .env Passthrough Injection
The WorldWideView core engine functions as a "blind pipe" for developer environment variables, allowing organizations to securely route plugins to custom backend microservices (local or cloud) without modifying the platform.
1. The developer adds `NEXT_PUBLIC_WWV_PLUGIN_EXAMPLE_URL="http://localhost:5001"` to their `.env.local`.
2. The engine detects the `NEXT_PUBLIC_WWV_PLUGIN_` prefix, strips it, and dynamically hydrates the `PluginContext`.
3. The plugin natively retrieves `ctx.env.EXAMPLE_URL`.
4. *Security Clause:* Variables accessible via `ctx.env` are exposed directly to the **client-side bundle**. Core secrets/API tokens must never be used here; they must exclusively use the server-side `ctx.getSecret()` workflow.

---

## Lazy Loading

Plugins load their code **only when activated**, not at startup:

```
Startup: load manifests from DB (one query) → globe with built-in plugins only
Toggle on "Aviation" → import() aviation bundle → register → fetch data
Toggle on "Cockpit View" → import() cockpit bundle → register
```

---

## Implementation Stack

| Piece | Library |
|---|---|
| Bundle loading | Native `import()` or `@module-federation/enhanced/runtime` |
| Manifest validation | `zod` |
| Sandboxing (unverified plugins) | `comlink` + Web Workers |
| Dependency resolution | `toposort` |
| Event system | `mitt` (200 bytes) |
| Plugin registry | Custom `PluginManager` class |

---

## Built-In Plugins (Current)

| Plugin | Format | Data Source |
|---|---|---|
| Aviation | bundle | OpenSky Network (ADS-B) |
| Maritime | bundle | AIS (maritime tracking) |
| Borders | bundle | GeoJSON from public API |
| Wildfire | bundle | NASA FIRMS |
| Military Bases | bundle (compiled) | OpenStreetMap (via Overpass) |
| Nuclear Facilities | bundle (compiled) | OpenStreetMap |
| Camera/CCTV | bundle | IP camera streams |
| GeoJSON | bundle | User-supplied GeoJSON files |

Future direction: Aviation and maritime redesigned as **declarative plugins** pointing to `api.worldwideview.dev` — your own API server handles polling, persistence, and history for all tenants.

---

## Creating Static OSM Plugins

For static plugins built from OpenStreetMap data, use the scaffold script:

```bash
node scripts/scaffold-osm-plugin.mjs '{
  "name": "volcanoes",
  "displayName": "Volcanoes",
  "description": "Active and dormant volcanoes worldwide from OSM",
  "osmTag": "natural=volcano",
  "icon": "Mountain",
  "color": "#ef4444",
  "category": "Natural Disaster"
}'
```

This queries Overpass API, converts to GeoJSON, scaffolds the package, and prints marketplace snippets.

**Common OSM tags:**

| Dataset | OSM Tag | ~Count |
|---------|---------|--------|
| Airports | `aeroway=aerodrome` | 40k |
| Seaports | `harbour=yes` | 15k |
| Nuclear facilities | `generator:source=nuclear` | 758 |
| Volcanoes | `natural=volcano` | 1.5k |
| Lighthouses | `man_made=lighthouse` | 20k |
| Embassies | `amenity=embassy` | 10k |
| Helipads | `aeroway=helipad` | 25k |
| Power plants | `power=plant` | 15k |
| Wind farms | `generator:source=wind` | 50k |

See skill: `.agents/skills/osm-static-plugin-creation.md`

---

## The Data Engine (Backend & Seeders)

When a plugin requires 24/7 background polling, long-term history (PostgreSQL), or high-frequency caching (Redis), it should leverage the **Data Engine**. The WWV architecture splits the frontend UI package and the backend data collection into two distinct tiers.

### 1. First-Party / Built-In Plugins
For plugins developed directly inside the WWV monorepo:
- **Seeder Module**: Developers write a single seeder (e.g. `seeders/aviation.ts`) inside the `wwv-data-engine` package.
- **Unified Container**: All first-party seeders run inside one singular `wwv-data-engine` Docker container. This prevents background polling from being destroyed by Next.js edge isolation or HMR.

### 2. Third-Party / Community Plugins (The VPS Problem)
Currently, **there is a high DX friction for third-party developers hosting their own heavy plugins.** 
- The `wwv-data-engine` is deeply coupled to the WWV host. Third-party developers cannot push their backend seeders into WWV's actual servers.
- The `wwv-plugin-sdk` only assists with the frontend `WorldPlugin` interface.
- Consequently, a sole developer with a VPS must write their own Node.js backend entirely from scratch to serve their custom data feeds, handle their own caching, and manage multiple Node instances if they create multiple plugins.

### 3. The Future: Distributable Data Engine Image
To solve this friction and make third-party plugin hosting highly intuitive, the WWV roadmap includes publishing a **WWV Mini-Engine** as a standalone Docker image:
1. **Lightweight Deployment:** Developers run `docker run worldwideview/mini-engine` on their VPS.
2. **Backend SDK:** They write simple `.ts` fetch scripts returning `GeoEntity[]` and drop them into a mounted `/seeders` volume.
3. **Zero Configuration:** The Docker engine hot-reloads these seeders, handles the Redis caching, and exposes standardized REST or WebSocket endpoints automatically. The developer focuses only on fetching data, avoiding all backend infrastructure setup.

See skill: `.agents/skills/data-engine-seeder-creation.md`

---

## Architectural Differences: WorldWideView (WWV) vs WorldMonitor (WM)

While WorldWideView draws UI/UX and feature inspiration from WorldMonitor as a baseline, the underlying plugin architectures are fundamentally different.

### WorldMonitor (The Inspiration)
- **Monolithic Frontend**: Layers and datasets are typically hardcoded directly into the application's core logic.
- **Custom Implementations**: Each data source usually requires its own bespoke API fetching, state management, and map rendering logic (e.g., raw Mapbox/Cesium objects).
- **Coupled Backend**: Data ingestion is often tightly coupled to the monolithic application or spread across scattered, heterogeneous microservices without a unified cache.

### WorldWideView (The Reality)
- **Extensible VS Code-Style Runtime**: Plugins are wholly independent, sandboxable modules loaded dynamically via activation events. The core map knows nothing about aviation or wildfires.
- **Unified Data Contract (`GeoEntity`)**: All data layers map their bespoke formats into a strict, unified `GeoEntity` system. The core engine handles clustering, filtering, and timeline playback generically—no custom rendering trickery needed per dataset.
- **Shared Data Engine**: WWV enforces a strict separation of concerns. All 24/7 API polling, data normalizations, and history retention happen off-thread in the singular `wwv-data-engine` (utilizing Redis hot cache + PostgreSQL history retention), providing a clean, unified REST interface for the plugin frontend. 
- **Cryptographic Trust**: WWV incorporates a signed marketplace registry and fine-grained capability declarations (`data:read`, `ui:sidebar`), establishing an enterprise-ready security posture for third-party extensions.

### Planned Features (Inspired by Monolithic Systems / WM)
While avoiding monolithic coupling, WWV plans to implement the following high-UX features natively or via generic plugin capabilities:

1. **Decentralized Plugin Connections (Agnostic Client)**: WorldWideView is entirely agnostic to the backend. It does NOT enforce a single unified pipeline. If a user activates 30 different plugins hosted on 30 different custom servers, the frontend will happily open 30 separate WebSocket connections. The client application knows absolutely nothing about the Data Engine—it only reads the `streamUrl` provided by each individual plugin's manifest.
2. **Cross-Layer Geofencing & Alerts**: A new `User Alert System` designed explicitly as a **plugin**. Utilizing the unified `GeoEntity` outputs, users can draw a polygon on the map and trigger webhooks/notifications if *any* entity from *any* active plugin crosses the boundary.
3. **Advanced Dead-Reckoning Hooks**: Building a `useDeadReckoning()` hook directly into the `@worldwideview/wwv-plugin-sdk`. It will automatically use standard `speed` and `heading` props to smoothly glide vehicle entities across the Cesium globe at 60 FPS between data pings, preventing plugin authors from rewriting complex math logic.
4. **Curated Workspaces / Scenarios**: The ability for users to save their current state as a "Workspace URL." This generates a shareable link that encodes the exact camera position, timeline bounds, activated plugins, and their respective layer configurations/filters.


## Local Plugins & Seeders

### 1. Local Sandbox Workflow
- **Scaffold**: `node packages/wwv-cli/dist/index.js create <name> --local` (creates inside `local-plugins/wwv-plugin-<name>`).
- **Develop**: `pnpm dev` triggers hot-reloading.
- **Promote**: `node packages/wwv-cli/dist/index.js link <name>` moves it to `packages/`.

### 2. Data Engine Seeders
Seeders in `wwv-data-engine/src/seeders/` provide the backend data.
- **Cron Seeder**: Uses `registerSeeder({ name: "plugin-id", cron: "..." })` and pushes to Redis via `setLiveSnapshot()`.
- **Init Seeder**: High-frequency or persistent websockets via `init: () => void`.
- **Constraint**: Seeder `name` MUST exactly match the frontend plugin `id`. Do not bundle workspace dependencies like `ws` or `zod` into the seeder `dist`.

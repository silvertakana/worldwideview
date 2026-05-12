---
trigger: model_decision
description: Architecture rules and conventions for the WorldwideView Next.js 16 frontend application, state management, and CesiumJS integration.
---

# WorldwideView Application Architecture

## 1. Core Framework
- Built on **Next.js 16 (App Router)** with `output: "standalone"`.
- Uses **React 19** and **TypeScript 5** (strict mode).
- **Styling**: Strictly Vanilla CSS. No Tailwind or CSS-in-JS.
- **Component File Size**: Max 150 lines per file. Split components, extract helpers, and use hooks for anything larger.

## 2. State & Event Bus
- **Zustand**: Slices handle global state (`globe`, `layers`, `timeline`, `ui`, `filter`, `data`, `config`, `favorites`, `geojson`).
- **DataBus**: Custom typed pub/sub singleton (`DataBus.getInstance().emit()`) decoupling React components from background WebSocket streams.

## 3. Edition System
Features are controlled by `NEXT_PUBLIC_WWV_EDITION`:
- `local`: Self-hosted, full features, auth.
- `cloud`: Managed instance.
- `demo`: Public demo, no auth.

## Source Layout


```
worldwideview/
├── .agents/             # AI agent workflows, rules, memories, skills
├── docs/                # Public-facing documentation
├── artifacts/
│   └── context/         # ← THIS FOLDER — private source of truth (not committed)
├── packages/            # Plugin packages (workspaces)
├── public/              # Static assets (Cesium assets, GeoJSON data files)
├── scripts/             # Build/utility scripts (copy-cesium.mjs, scaffold-osm-plugin.mjs, etc.)
└── src/
    ├── app/             # Next.js App Router (layouts, pages, API routes)
    ├── components/      # React UI components (HUD, LayersPanel, Panels, Sidebar)
    ├── core/
    │   ├── data/        # DataBus, PollingManager, CacheLayer
    │   ├── globe/       # Cesium hooks, viewer lifecycle, primitive collections
    │   └── plugins/     # Plugin registry, lifecycle, loaders
    ├── lib/             # Shared utilities, server-side logic
    │   └── marketplace/ # Marketplace bridge (auth, token, CORS, repository)
    └── plugins/         # Built-in feature plugins (aviation, maritime, borders, etc.)
```

---

## Module Breakdown

### `src/core/data/` — The Heartbeat

- **DataBus**: Decentralized event pipeline for all system actions. Plugins emit, components subscribe.
- **PollingManager**: Intelligent scheduler for external API calls with exponential backoff.
- **CacheLayer**: 2-stage persistent caching — In-Memory + IndexedDB (`worldwideview-cache`).

### `src/core/globe/` — Rendering Engine

- **Cesium Integration**: Low-level control over the Cesium Viewer and Primitive Collections.
- **EntityRenderer**: High-performance Primitive-based renderer. See `Primitives vs. Entities` below.
- **Spiderifier & Clustering Engine** (`StackManager.ts` & `stackAnimation.ts`):
  - Automatically identifies overlapping entities and groups them into geometrically balanced clusters (concentric rings for <18 density, Fermat's golden spiral for massive stacks).
  - **Mobile Layout Constraints**: Integrates responsive coordinate geometry. Modifies logical icon dimensions via `iconUpscaler.ts` (32px mobile / 48px desktop) and scales the radial expansion offsets proportionally by 70% on mobile displays to ensure tight, aesthetically pleasing clusters without massive gaps.
  - **Z-Fighting Mitigation**: Clustering involves highly frequent stack rebuild cycles on any zoom/pan delta. To prevent chaotic render flickering, the global `AnimationLoop` explicitly yields visibility management to `stackAnimation.ts` via `isEntityClustered()`. Items transitioning into the `collapsed` state intentionally bypass animation lerping (to prevent 220ms ghost visibility bleed) and mathematically cloak themselves instantly.
- Globe is initialized via `GlobeView.tsx`. Viewer instance passed via `CesiumContext`.

### `src/core/plugins/` — Plugin System

- **PluginManager**: Registers, boots, and destroys plugins. Enforces capability checks.
- **Loaders**: Plugins are dynamically imported at runtime as ES module bundles (`loadPluginFromManifest`). The legacy `StaticDataPlugin` and `DeclarativePlugin` runtimes are fully deprecated.
- **Manifest Requirement**: All plugins MUST include a `"worldwideview"` manifest block in their `package.json` (containing `id`, `icon`, `category`, and `format`). This is strictly required by the Marketplace in order to parse display attributes correctly.

---

## Performance: Primitives vs. Entities

**Core design decision:** Use Cesium `Primitive` API instead of the high-level `Entity` API for high-count datasets.

| Feature | Entity API | Primitive API (WWV) |
|---|---|---|
| **Abstraction** | High (easy to use) | Low (direct GPU access) |
| **JS Overhead** | Significant per-entity objects | Minimal (batched draw calls) |
| **Max Capacity** | ~1,000 entities | **100,000+ points/billboards** |
| **WWV Use Case** | Info window / detail panel content | Live data point visualization |

Specifically: `PointPrimitiveCollection` and `BillboardCollection` ensure 60FPS even with dense global data. The full migration from Entity-based rendering to Primitives was completed to eliminate severe FPS drops.

---

## Globe Occlusion & Depth Testing

- **Correct approach:** `depthTestAgainstTerrain = false` — uses GPU to depth-test against the smooth WGS84 ellipsoid. Icons visible on the near hemisphere, correctly occluded behind Earth.
- **Avoid:** `eyeOffset`, `disableDepthTestDistance` hacks that push entities in front of everything. These cause icons to bleed through the globe.
- The Plugin SDK's `CesiumEntityOptions` exposes this via `disableDepthTestDistance` when absolutely needed for specific usecases.

---

## Data Pipeline (Example: Aviation)

```
Remote API (e.g. OpenSky)
    ↓  [raw JSON, every ~30s via PollingManager]
Plugin (e.g. AviationPlugin)
    ↓  [parse, filter, sanitize → GeoEntity[]]
DataBus.emit("dataUpdated", { entities })
    ↓
EntityRenderer [batched Primitive update]
    ↓
GPU (CesiumJS) → 60FPS visualization
```

---

## Database (Unified PostgreSQL)

**Location:** We have migrated from a fragmented SQLite + PostgreSQL setup to a unified **PostgreSQL** architecture using Prisma 7 with the `@prisma/adapter-pg` driver. This enables true multi-tenant cloud capability, real-time sync, and scalable connection pooling via `DATABASE_URL`.

**Next.js Core Tables:**
| Model | Table | Purpose |
|---|---|---|
| `User` | `users` | Auth accounts (email, bcrypt password, role) |
| `InstalledPlugin` | `installed_plugins` | Marketplace plugin install records |
| `Setting` | `settings` | Key-value app config (Cesium token, map style, etc.) |
| `Tenant` | `tenants` | Multi-tenant organization boundaries |

**Data Engine Tables:**
Managed explicitly via optimized queries in `packages/wwv-data-engine/src/db.ts` targeting PostgreSQL to maximize ingest performance.
Includes tables like `iranwar_events`, `earthquakes`, `wildfires`, and `maritime_history`.

> [!WARNING]
> **Catastrophic Time-Series Polling (The Lookback Trap):**
> High-frequency polling (e.g. 6,000 aircraft every 10s) accumulates millions of rows rapidly. 
> - **DO NOT** query unindexed columns (like `ts`) for lookback/freshness without a dedicated index, otherwise you will trigger full table scans and 500 Route timeout errors.
> - **REQUIRED:** Implement aggressive data retention / hourly pruning via `scheduler.ts` to prevent infinite table growth.
> - **PREFERRED:** Keep real-time / spatial lookbacks in Redis (like `getLiveSnapshot()`), and leave PostgreSQL strictly for historical chronological replays that hit standard indices.

**Hot-Caching (Redis) & Connection Rules:**
The `wwv-data-engine` polls external APIs, dumps raw payloads to PostgreSQL for historical persistence, and broadcasts active snapshots via WebSockets while persisting to Upstash Redis. The Next.js frontend fetches initial state from Redis to ensure horizontal scalability.
*TLS Connection Requirement:* The `REDIS_URL` mapped in Coolify and `.env.local` must use the `rediss://` protocol for TLS encryption. Attempting to use plain `redis://` with Upstash will cause the connection to drop (`ECONNRESET`) and throw a `MaxRetriesPerRequestError (which is 3)` inside the data engine.
*Upstash Request Limit Throttling:* Due to Upstash Serverless billing (capped at 10k requests/day or 500k/month on free tier), the data engine decouples WebSocket live broadcasting from Redis persistence. High-frequency scrapers (like Aviation) run every 15 seconds to push WebSockets, but the backend forces a **5-minute throttle** before saving the next snapshot to Upstash using `zlib` compression. This executes just 2 commands (`SET` and `EXPIRE`) per 5 minutes per scraper, completely eliminating `max requests limit exceeded` errors while retaining real-time frontend updates.

**Resilience (Data Self-Healing):**
Even with persistent PostgreSQL, critical history (like `iranwarlive` events) should be bundled as `seed.json` or `history.csv` artifacts. If the Data Engine detects an empty table, it MUST parse its built-in fallback seed to hydrate the database and Redis, ensuring 100% data recovery without manual intervention.

**Dynamic Engine URL Resolution:**
The decoupled Data Engine lives at `http://localhost:5001` during local development, and deploys to `https://dataengine.worldwideview.dev` in production. The Next.js frontend injects this context directly into the plugin via the `ctx.env` object (specifically reading from `NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL` environment variables). Plugins resolve their required backend natively by parsing `this.context.env.DATA_ENGINE_URL`. The legacy `globalThis.__WWV_ENGINE_URL__` proxy approach has been fully deprecated.

---

## Settings Architecture

User-configurable values live in the `settings` table (not `.env`). They can be updated without rebuilds.

| Setting Type | Where | Example |
|---|---|---|
| **Infrastructure** | `.env` | `DATABASE_URL`, `NEXT_PUBLIC_WWV_EDITION` |
| **User settings** | `settings` table (DB) | Cesium token, map style, API keys |

**Setup Wizard:** If `cesium_token` is missing from the DB on first load, the app shows a setup wizard. Plugin-level wizards work the same way — plugin declares required settings in its manifest; if missing, it renders a setup form instead of data.

---

## Design Principles

- **Single Responsibility:** Plugins only handle data mapping — they don't know about UI or cache.
- **Dependency Inversion:** `PluginManager` communicates via the `WorldPlugin` interface — new plugins don't require core changes.
- **Event-Driven:** Components subscribe to what they need via DataBus — no prop-drilling.
- **Defensive Programming:** All external calls wrapped in error boundaries + `PollingManager` backoff.

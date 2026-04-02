# WorldWideView — Agent Rules

## 1. Project Identity

WorldWideView is a **real-time geospatial intelligence engine** that visualizes live global data on an interactive 3D globe. Built with **Next.js 16**, **CesiumJS**, **React 19**, and **Zustand**, it renders everything from live aircraft and maritime vessels to conflict events, satellites, and environmental data — all through a modular plugin architecture.

### Target Inspiration
Our primary design, feature-set, and operational layout goal is to mimic the structure and capabilities of `www.worldmonitor.app`.
- **Reference Codebase**: [GitHub - koala73/worldmonitor](https://github.com/koala73/worldmonitor)
---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, `output: "standalone"`) |
| Language | TypeScript 5, strict mode |
| 3D Engine | CesiumJS + Resium (Google Photorealistic 3D Tiles) |
| State | Zustand (slice-based: globe, layers, timeline, UI, filters, data, config, favorites, geojson) |
| Event Bus | Custom typed `DataBus` (pub/sub singleton) |
| Styling | Vanilla CSS — **no Tailwind** |
| Database | SQLite via Prisma (local), PostgreSQL (cloud) |
| Auth | NextAuth v5 beta (Credentials provider, JWT sessions) |
| Package Manager | pnpm (monorepo with `pnpm-workspace.yaml`) |
| Testing | Vitest + jsdom + React Testing Library |
| Deployment | Docker multi-stage build → Coolify |
| Analytics | Vercel Analytics / custom `trackEvent` |

---

## 3. Directory Structure

```
worldwideview/
├── src/
│   ├── app/               # Next.js App Router (pages, API routes, layouts)
│   │   ├── api/           # Server-side API routes (auth, aviation, camera, etc.)
│   │   ├── login/         # Login page
│   │   ├── setup/         # First-time setup page
│   │   └── globals.css    # Root stylesheet
│   ├── components/
│   │   ├── common/        # Shared UI: BootOverlay, FloatingWindow, PluginIcon
│   │   ├── layout/        # AppShell, Header, SearchBar, DataBusSubscriber
│   │   ├── panels/        # LayerPanel, EntityInfoCard, FilterPanel, GraphicsSettings
│   │   ├── timeline/      # Timeline component
│   │   ├── marketplace/   # Plugin install/unverified dialogs
│   │   ├── ui/            # Tooltip, ReloadToast
│   │   └── video/         # Floating video manager
│   ├── core/
│   │   ├── data/          # DataBus, PollingManager, CacheLayer, SmartFetcher
│   │   ├── filters/       # filterEngine (applies plugin filters to entities)
│   │   ├── globe/         # GlobeView, EntityRenderer, AnimationLoop, StackManager,
│   │   │   │                CameraController, InteractionHandler, SelectionHandler,
│   │   │   │                ModelManager, ImageryProviderFactory
│   │   │   └── hooks/     # useCameraActions, useEntityRendering, useModelRendering, etc.
│   │   ├── hooks/         # useBootSequence, useIsMobile, useMarketplaceSync
│   │   ├── plugins/       # PluginManager, PluginRegistry, PluginManifest,
│   │   │   │                loadPluginFromManifest, validateManifest, InstalledPluginsLoader
│   │   │   └── loaders/   # DeclarativePlugin, StaticDataPlugin, mapJsonToEntities
│   │   └── state/         # Zustand store + slices (config, data, globe, layers, timeline, ui, etc.)
│   ├── lib/               # auth, db, rateLimit, analytics, AIS stream, marketplace APIs
│   ├── plugins/           # GeoJSON plugin registrations
│   ├── styles/            # HUD animations CSS
│   ├── types/             # GeoJSON types, Umami types
│   └── generated/         # Prisma generated client (gitignored)
├── packages/              # pnpm monorepo workspace packages
│   ├── wwv-plugin-sdk/    # Plugin SDK: type definitions, manifest schema
│   ├── wwv-plugin-aviation/
│   ├── wwv-plugin-maritime/
│   ├── wwv-plugin-wildfire/
│   ├── wwv-plugin-borders/
│   ├── wwv-plugin-camera/
│   ├── wwv-plugin-military-aviation/
│   ├── wwv-plugin-satellite/
│   ├── wwv-plugin-iranwarlive/   # Includes standalone backend/ microservice
│   └── wwv-plugin-{airports,embassies,lighthouses,nuclear,seaports,spaceports,volcanoes}/
├── prisma/                # schema.prisma, migrations/
├── public/                # Static assets, Cesium workers, plugin GeoJSON data
├── scripts/               # Build scripts (copy-cesium, scaffold-osm-plugin, setup)
├── data/                  # SQLite database (gitignored, Docker volume)
├── Dockerfile             # Multi-stage production build
├── docker-compose.yml     # Main app + microservice backends
└── .agents/               # Agent documentation, rules, skills, workflows
```

---

## 4. Architecture Patterns

### 4.1 Plugin System (Core Abstraction)

Every data source is a **plugin** implementing the `WorldPlugin` interface from `@worldwideview/wwv-plugin-sdk`. The lifecycle is:

```
PluginRegistry.register() → PluginManager.registerPlugin()
  → plugin.initialize(context) → PollingManager.register()
  → PluginManager.enablePlugin() → plugin.fetch(timeRange)
  → DataBus.emit("dataUpdated") → Store → EntityRenderer → Globe
```

Three plugin architectures exist:
1. **Static** — GeoJSON file in `public/data/`, loaded by `StaticDataPlugin`
2. **Active Proxied** — Next.js API routes in `src/app/api/` as CORS proxy
3. **Microservice** — Standalone Fastify container with SQLite (e.g., `iranwarlive-backend`)

Plugin types are re-exported from SDK through `src/core/plugins/PluginTypes.ts` and `PluginManifest.ts` — **source of truth is always `@worldwideview/wwv-plugin-sdk`**.

### 4.2 State Management

Zustand store with **nine slices**: `globe`, `layers`, `timeline`, `ui`, `filter`, `data`, `config`, `favorites`, `geojson`. Each slice is in its own file under `src/core/state/`.

- Access via `useStore` hook or `useStore.getState()` outside React
- Plugin settings stored in `configSlice.dataConfig.pluginSettings`
- Polling intervals stored in `configSlice.dataConfig.pollingIntervals`

### 4.3 Data Pipeline

```
Plugin.fetch() → PluginManager.handleDataUpdate()
  → CacheLayer.set() (memory + IndexedDB)
  → DataBus.emit("dataUpdated")
  → DataBusSubscriber → Store.entitiesByPlugin
  → GlobeView (memoized visible entities)
  → EntityRenderer (billboard/point primitives)
  → AnimationLoop (horizon culling, hover/selection)
  → StackManager (co-located entity grouping)
```

### 4.4 Rendering Pipeline

- **Primitive-based**: Uses `PointPrimitiveCollection`, `BillboardCollection`, `LabelCollection` — NOT Cesium Entity API
- **Chunked processing**: Large datasets (10k+) rendered via `ChunkedProcessor`
- **LOD system**: Model-type entities promoted to 3D models at close range (`useModelRendering`)
- **Horizon culling**: Manual dot-product calculation against Earth radius (NOT depth testing)
- **Stack/Spiderifier**: `StackManager` groups co-located entities; `stackAnimation` handles expansion

### 4.5 Edition System

Three editions controlled by `NEXT_PUBLIC_WWV_EDITION`:
- **`local`** — Self-hosted, full features, auth enabled
- **`cloud`** — Managed cloud instance, full features
- **`demo`** — Public demo, auth disabled, optional admin via `WWV_DEMO_ADMIN_SECRET`

Feature flags derived from edition in `src/core/edition.ts`.

---

## 5. Critical Conventions

### 5.1 File Size

**Max 150 lines per file.** If a file grows beyond this, modularize it. Extract helpers, split components, use hooks.

### 5.2 Import Aliases

- `@/*` → `./src/*`
- `@worldwideview/wwv-plugin-sdk` → `./packages/wwv-plugin-sdk/src`
- Each plugin has its own alias in `tsconfig.json`

### 5.3 CSS Rules

- **Vanilla CSS only** — no Tailwind, no CSS-in-JS
- Global styles in `src/app/globals.css`
- Component-scoped styles use CSS Modules (`.module.css`) or co-located `.css` files
- HUD animations in `src/styles/hud-animations.css`

### 5.4 Rendering Entity Rules

When returning `CesiumEntityOptions` from `renderEntity()`:

- **Points**: Use `type: "point"` with `color`, `size`, `outlineColor`, `outlineWidth`
- **Billboards**: Use `type: "billboard"` with `iconUrl`, `color`, `iconScale`
- **NEVER mix**: Do not use `size`/`outlineWidth`/`outlineColor` on billboard entities — causes GPU clipping

### 5.5 Plugin Registration

Built-in plugins are instantiated in `AppShell.tsx` and registered via `PluginRegistry` → `PluginManager`. Marketplace-installed plugins are loaded from the database via `InstalledPluginsLoader`.

### 5.6 Workspace Rules

- Always run `pnpm install` from project root after creating new packages
- Plugin packages go in `packages/wwv-plugin-<name>/`
- Microservice backends go in `packages/wwv-plugin-<name>/backend/`
- Both globs (`packages/*` and `packages/*/backend`) are in `pnpm-workspace.yaml`
- Add new plugins to `transpilePackages` in `next.config.ts` and `paths` in `tsconfig.json`

### 5.7 AI Meta-Directives: Antigravity Standard
> [!WARNING]
> This repository is orchestrated strictly via **Antigravity**. 
> - **Always** use standard `.md` file extensions for rules, skills, and workflows. 
> - **Never** use proprietary `.mdc` extensions.
> - **Never** reference Cursor IDE rules; we use the open `.agents/` standard.

---

## 6. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | SQLite: `file:./data/wwv.db` |
| `AUTH_SECRET` | Yes | JWT signing secret (generate with `openssl rand -hex 32`) |
| `NEXT_PUBLIC_CESIUM_ION_TOKEN` | No | Cesium Ion access token |
| `NEXT_PUBLIC_BING_MAPS_KEY` | No | Bing Maps imagery |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | No | Google 3D Tiles |
| `NEXT_PUBLIC_WWV_EDITION` | No | `local` / `cloud` / `demo` (default: `local`) |
| `OPENSKY_CREDENTIALS` | No | Comma-separated `id:secret` pairs for credential rotation |
| `WWV_BRIDGE_TOKEN` | No | Shared secret for marketplace → WWV install bridge |
| `WWV_DEMO_ADMIN_SECRET` | No | Demo edition admin password |
| `IRANWARLIVE_BACKEND_URL` | No | Override for IranWarLive microservice URL |

Secrets go in `.env.local` (gitignored). Non-secrets go in `.env` (committed).

---

## 7. Development Commands

```bash
pnpm dev                # Start dev server (runs prisma migrate + copy-cesium first)
pnpm build              # Production build
pnpm test               # Run vitest
pnpm start:backends     # Start all plugin microservice backends in parallel
pnpm clean:backends     # Wipe all plugin SQLite databases
```

---

## 8. Deployment

- **Docker**: Multi-stage Dockerfile using the Extractor Pattern (`deps` → `builder` → `runner`). The `node_modules` folders must be explicitly untracked in from `git` across the workspace to prevent corrupted BuildKit contextual cache overlaps during the `COPY . .` stage.
- **Standalone output**: `next.config.ts` uses `output: "standalone"`.
- **Cesium assets**: Copied to `public/cesium/` via `scripts/copy-cesium.mjs` at build time, excluded from output tracing.
- **Prisma Configuration**: `prisma.config.ts` must export a native javascript object instead of dynamically importing CLI wrapper binaries (`prisma/config` or `dotenv`). The standalone Next.js tracer strips CLI devDependencies during the build, which will cause fatal runtime container crashes if imported.
- **Microservices**: Separate containers defined in `docker-compose.yml`, proxied via `next.config.ts` rewrites.
- **Coolify**: Deployed via Dockerfile builder natively mapping environment variables continuously into the container shell. Persistent storage mount required at `/app/data` for the SQLite root node database.

---

## 9. Testing Strategy

- **Framework**: Vitest with jsdom environment
- **Coverage**: `src/lib/**`, `src/core/**`, `src/plugins/**`
- **Run**: `pnpm test` (or `vitest run`)
- **Key test files**: `rateLimit.test.ts`, `edition.test.ts`, `demoAdmin.test.ts`, `DeclarativePlugin.test.ts`, `cors.test.ts`, `repository.test.ts`, `marketplaceToken.test.ts`

---

## 10. Security Headers

Configured in `next.config.ts` `headers()`:
- **CSP**: Restrictive with exceptions for CesiumJS (`unsafe-eval`, `unsafe-inline`), camera streams (`http: https:`), and analytics
- **X-Frame-Options**: DENY
- **X-Content-Type-Options**: nosniff
- **Referrer-Policy**: strict-origin-when-cross-origin
- **Permissions-Policy**: camera/microphone disabled, geolocation self-only

---

## 11. Related Repositories

| Repo | Purpose |
|---|---|
| `worldwideview` | Main application (this repo) |
| `worldwideview-marketplace` | Plugin marketplace web app |
| `worldwideview-web` | Marketing / landing page |

---

## 12. Agent Skills Reference

Refer to these skill documents in `.agents/skills/` for specialized tasks:

| Skill | When to Use |
|---|---|
| `plugin-creation-master-guide.md` | Decision matrix for choosing plugin architecture |
| `osm-static-plugin-creation.md` | Creating static GeoJSON plugins from OpenStreetMap |
| `microservice-plugin-creation.md` | Building standalone Fastify microservice backends |
| `database-operations.md` | Prisma schema changes, migrations, database queries |
| `index-documentation.md` | Maintaining project documentation index |

<!-- Generated: 2026-04-19 15:23:00 UTC -->
# Files Catalog

WorldWideView maps rigid structural directories to manage its layered microservice architecture, distinguishing tightly between UI layout routing, system memory, 3D visualization, and microservice ingestion mechanisms.

Every major component is siloed deeply to ensure the monolithic main engine remains perfectly isolated and agnostic to individual data sources. 

## Core Source Files
- `src/app/` - The Next.js 16 core routing platform, housing layout constraints, `api/` backends, and full-screen auth portals.
- `src/components/` - Segmented React JSX components handling overlay panels, timeline UI, and floating popups.
- `src/core/plugins/` - Essential bridge scripts that validate manifested metadata parameters before dynamically allocating JS module environments to run external logic. (`PluginManager.ts`)

## Platform Implementation
- `src/core/globe/GlobeView.tsx` - Initializer mapping global config hooks to the main Cesium `Viewer`.
- `src/core/globe/EntityRenderer.tsx` - Extremely hot processing loop extracting Zustand state variables directly to WebGL GPU hardware calls via Cesium Primitives.
- `src/core/globe/StackManager.ts` - Spiderifier spatial engine dynamically resolving overlapping coordinate markers geometrically in 3D-space.

## Build System
- `Dockerfile` - Multi-stage container instructions targeting a 110MB production Alpine build footprint.
- `next.config.ts` - NextJS 16 overrides forcing standalone rendering extraction and tight CSP headers.
- `prisma/schema.prisma` - DB tables strictly configuring Prisma to bind exclusively towards locally-mounted SQLite structures.

## Configuration
- `.agents/` - Complete repository workflow configuration (Antigravity Code). Contains AI `rules/`, `skills/`, and internal architectural `context/` for automatic coordination. 
- `public/cesium/` - Runtime engine bundles duplicated exclusively during pre-build tracking (copied from `node_modules`).

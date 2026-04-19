<!-- Generated: 2026-04-19 02:20:00 UTC -->
# WorldWideView - Build System

## Overview
The WWV build system compiles a Next.js (App Router) interface along with an internal plugin monorepo into a single optimized standalone artifact. Static assets and OSM data pipelines are built automatically using custom sync scripts that compile GeoJSON into standalone ESM JS bundles.

## Build Workflows
- **Install**: `pnpm install` handles workspace dependency mapping across all `wwv-plugin-*` folders.
- **Frontend Sync**: `pnpm dev` triggers the frontend and runs `copy-cesium.mjs` internally to place static map workers into the public folder.
- **Plugin compilation**: The `pnpm run sync` script inside `/worldwideview-plugins/scripts/sync-local.mjs` (or similar compiler scripts) bundles raw data payloads (e.g. `plugin.json` formats) into executable files `frontend.mjs` resolving the `All-Bundle` requirement.

## Package Manager Configuration
- Configuration details are specified in [`pnpm-workspace.yaml`](../pnpm-workspace.yaml).
- Next.js build compilation leverages standard `output: "standalone"` via [`next.config.ts`](../next.config.ts).

## Platform Setup
- **Cesium Resources**: To fetch and run locally, you must provide valid API keys inside `.env.local` for features to properly render.
- Custom plugins exist within `packages/wwv-plugin-<name>/`. They need to be explicitly placed in `next.config.ts#transpilePackages` to prevent compiler failure during dev.

## Reference
- **Cesium Sync**: [`scripts/copy-cesium.mjs`](../scripts/copy-cesium.mjs)
- **Plugin Scaffolding**: [`scripts/scaffold-osm-plugin.mjs`](../scripts/scaffold-osm-plugin.mjs)
- **Standalone Artifact**: Built output lives inside `.next/standalone/server.js`.

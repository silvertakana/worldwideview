<!-- Generated: 2026-04-23 06:11:00 UTC -->
# Files Catalog

## Overview
WorldWideView is structured as a pnpm monorepo. The primary application resides in the root `src/` directory, while external dependencies, plugins, and the core Plugin SDK are abstracted into the `packages/` directory.

The system is highly modularized to separate React UI rendering from heavy CesiumJS 3D operations and high-frequency real-time WebSocket state management.

## Core Source Files
- `src/app/` - The Next.js App Router entry points. Contains `layout.tsx` (the core React shell), `page.tsx` (the globe view), and `/api/` (server-side NextAuth and API handlers).
- `src/core/plugins/PluginManager.ts` - Central orchestration unit for dynamic plugins. Handles loading, lifecycle (`initialize`, `destroy`), and manifest resolution.
- `src/core/globe/GlobeView.tsx` - The primary CesiumJS container. It memoizes Zustand state to prevent heavy re-renders while injecting `EntityRenderer` primitives.
- `src/core/data/DataBus.ts` - Singleton pub/sub event bus handling all high-velocity WebSocket stream events without triggering React re-renders.
- `src/core/state/store.ts` - The primary Zustand state registry exporting all nine discrete slices (`globe`, `layers`, `timeline`, `ui`, `filter`, `data`, `config`, `favorites`, `geojson`).

## Platform Implementation
- `src/core/plugins/loaders/InstalledPluginsLoader.ts` - Platform-specific loader that dynamically injects ES module CDNs via `import(/* webpackIgnore: true */)`.
- `src/core/globe/hooks/useCameraActions.ts` - Abstraction connecting React UI logic to raw CesiumJS camera math (flyTo, lookAt).
- `src/lib/edition.ts` - Platform edition configuration. Exposes runtime feature flags for `local`, `cloud`, and `demo` deployments.

## Build System
- `package.json` - Root monorepo configuration with `pnpm` workspace bindings.
- `next.config.ts` - Next.js compiler settings, security headers, and standalone output configuration.
- `docker-compose.yml` - Defines the orchestration of the frontend, Redis cache, and all local plugin microservice backends (`wwv-data-engine`).

## Configuration
- `prisma/schema.prisma` - Local SQLite and cloud PostgreSQL database schema for storing user settings and installed plugin manifests.
- `scripts/copy-cesium.mjs` - Crucial build-time script that extracts and copies CesiumJS static web workers to `public/cesium/`.
- `public/` - Static assets, plugin icons, and compiled Cesium workers.

## Reference
- **Plugins Directory:** All plugins conform to the `@worldwideview/wwv-plugin-sdk` interface and are developed inside `packages/wwv-plugin-<name>/`.
- **Microservices Directory:** Standalone Fastify backends are nested within `packages/wwv-plugin-<name>/backend/`.

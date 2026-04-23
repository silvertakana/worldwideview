<!-- Generated: 2026-04-23 06:11:00 UTC -->
# Project Overview

WorldWideView is a real-time geospatial intelligence engine that visualizes live global data on an interactive 3D globe. It leverages a modern frontend stack to render high-density datasets synchronously, including aircraft, maritime vessels, conflict events, satellites, and environmental data.

The core value proposition of WorldWideView is mapping diverse, decoupled intelligence streams onto a central geographic interface using a dynamically loaded plugin architecture. Data sources operate completely decoupled from the display platform, streaming observations via WebSockets for sub-second visual updates. The ecosystem consists of multiple repositories, including the main app (`worldwideview`), the plugin marketplace (`worldwideview-marketplace`), and the WebSocket push server (`wwv-data-engine`).

## Key Files
- `package.json` (Lines 1-76) - Core dependencies and project metadata for the monorepo workspace.
- `src/app/layout.tsx` - Global application shell and React structure.
- `src/core/plugins/PluginManager.ts` - Heart of the engine, registers and lifecycle-manages external intelligence views.
- `src/core/globe/GlobeView.tsx` - Main Cesium globe component rendering.

## Technology Stack
- **Framework:** Next.js 16 (App Router) — `src/app/`
- **Language:** TypeScript 5 (Strict Mode) — `tsconfig.json`
- **3D Engine:** CesiumJS + Resium (Google Photorealistic 3D Tiles) — `src/core/globe/GlobeView.tsx`
- **State Management:** Zustand — `src/core/state/` (slice-based store)
- **Event Bus:** Custom typed `DataBus` — `src/core/data/DataBus.ts`
- **Database:** SQLite via Prisma (local), PostgreSQL (cloud) — `prisma/schema.prisma`
- **Styling:** Vanilla CSS (no Tailwind) — `src/app/globals.css`

## Platform Support
Built as a highly portable Next.js container, it supports multiple deployment profiles controlled by `NEXT_PUBLIC_WWV_EDITION` (default: `local`).
- **Local (`local`)**: Self-hosted, full features, auth enabled.
- **Cloud (`cloud`)**: Managed cloud instance, full features.
- **Demo (`demo`)**: Public demo, auth disabled, optional admin via `WWV_DEMO_ADMIN_SECRET`.
Feature flags are evaluated at runtime in `src/core/edition.ts`.

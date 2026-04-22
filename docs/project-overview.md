<!-- Generated: 2026-04-19 15:23:00 UTC -->
# Project Overview

WorldWideView is a real-time geospatial intelligence engine that visualizes live global data on an interactive 3D globe. It leverages a modern frontend stack to render high-density datasets (aircraft, maritime vessels, conflict events, environmental data) synchronously.

The core value proposition is mapping diverse, decoupled intelligence streams onto a central geographic interface using a dynamically loaded plugin architecture. Data sources operate completely decoupled from the display platform, streaming observations via WebSockets for sub-second visual updates.

## Key Files
- `package.json` (lines 1-80) - Core dependencies and project metadata.
- `src/app/layout.tsx` (lines 15-40) - Global application shell and React structure.
- `src/core/plugins/PluginManager.ts` (lines 20-56) - Heart of the engine, registers and lifecycle-manages external intelligence views.

## Technology Stack
- **Framework:** Next.js 16 (App Router) — `src/app/`
- **3D Engine:** CesiumJS + Resium — `src/core/globe/GlobeView.tsx` (lines 40-90)
- **State Management:** Zustand — `src/core/state/store.ts` (slice pattern)
- **Database:** Prisma ORM w/ SQLite locally — `prisma/schema.prisma`
- **Typing:** TypeScript 5 w/ Strict Mode — `tsconfig.json`

## Platform Support
Built as a highly portable Next.js container, it supports `local`, `cloud`, and `demo` editions via the `NEXT_PUBLIC_WWV_EDITION` flag declared in `.env.local` and evaluated at runtime in `src/core/edition.ts`.

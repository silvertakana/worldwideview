<!-- Generated: 2026-04-19 02:20:00 UTC -->
# WorldWideView - Project Overview

## Overview
WorldWideView is a real-time geospatial intelligence engine that visualizes live global data on an interactive 3D globe. It renders everything from aircraft, maritime vessels, conflict events, and satellites using a highly modular All-Bundle plugin architecture.

The core value proposition is the extensible VS Code-style runtime environment where datasets (plugins) are wholly independent sandboxable modules loaded dynamically via activation events. This decouples the core rendering engine from data ingestion logic.

## Key Files
- **Agent Rules**: [AGENTS.md](../AGENTS.md) - The central system prompts and core architectural constraints.
- **Plugin Loader**: [src/core/plugins/loadPluginFromManifest.ts](../src/core/plugins/loadPluginFromManifest.ts) - The unified All-Bundle entry point for all frontend plugins.
- **Main App Shell**: [src/components/layout/AppShell.tsx](../src/components/layout/AppShell.tsx) - Initializes core components and the map.
- **Data Bus**: [src/core/data/DataBus.ts](../src/core/data/DataBus.ts) - Real-time websocket data routing.

## Technology Stack
- **Framework**: Next.js 16 (App Router)
- **3D Engine**: CesiumJS + Resium (see `src/core/globe/GlobeView.tsx`)
- **State**: Zustand slice-based store (e.g. `src/core/state/globeSlice.ts`)
- **Plugin System**: Native dynamic ES module imports
- **Styling**: Vanilla CSS (`src/app/globals.css`)
- **Database**: SQLite via Prisma (`prisma/schema.prisma`)
- **Auth**: NextAuth v5 beta (`src/lib/auth.ts`)

## Platform Support
WorldWideView natively supports three edition tiers controlled by `NEXT_PUBLIC_WWV_EDITION`:
- **Local**: Self-hosted instances with auth enabled (`src/core/edition.ts`).
- **Cloud**: Managed setups with Postgres endpoints.
- **Demo**: Public instances defaulting to unauthenticated read-only layers.

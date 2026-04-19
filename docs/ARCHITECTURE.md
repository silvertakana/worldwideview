<!-- Generated: 2026-04-19 02:20:00 UTC -->
# WorldWideView - Architecture

## Overview
WorldWideView fundamentally separates the core 3D spatial rendering engine from the data ingest protocols. It achieves this primarily through a custom 'Data Engine' that funnels external data directly into a local state via WebSocket streams and a strict 'All-Bundle' dynamic plugin loader.

UI features conform strictly to a VS Code-style extension pipeline using capability declarations rather than deeply coupling into monolithic application code.

## Component Map
- **Globe Core**: The Cesium 3D canvas and interaction loops. (`src/core/globe/GlobeView.tsx`)
- **Plugin Registry**: Registration, validation, and execution pipeline for all 3rd party components. (`src/core/plugins/PluginManager.ts`)
- **Event Bus Pipeline**: High-throughput web socket translation. (`src/core/data/DataBus.ts`)
- **Store**: Unified state for UI and filtering. (`src/core/state/`)
- **Data Engine**: The backend container managing persistent Redis caching and sqlite history (`packages/wwv-data-engine/`).

## Key Files
- [src/core/plugins/loadPluginFromManifest.ts](../src/core/plugins/loadPluginFromManifest.ts): Fetches bundle plugins asynchronously from CDN or local storage and triggers their init sequence.
- [packages/wwv-plugin-sdk/src/manifest.ts](../packages/wwv-plugin-sdk/src/manifest.ts): Core typing definitions for `PluginManifest` and capability enums.
- [src/core/data/DataBus.ts](../src/core/data/DataBus.ts): Manages `dataUpdated` and websocket frame distribution events.

## Data Flow
1. User activates a Plugin via UI (triggers `activationEvents`).
2. `PluginManager` invokes `loadPluginFromManifest.ts` which uses ES imports.
3. Once active, the plugin connects to its data source (or the central WebSocket).
4. Raw data hits `DataBusSubscriber` -> emitted to `DataBus.emit("dataUpdated")`.
5. The `Zustand` store's `dataSlice.ts` captures this, structuring by plugin ID.
6. The `EntityRenderer.tsx` diffs the new state and renders primitives.

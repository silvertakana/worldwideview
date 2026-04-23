<!-- Generated: 2026-04-23 06:11:00 UTC -->
# Architecture

## Overview
WorldWideView operates on a decoupled, plugin-based architecture designed for real-time visualization of geospatial data. The system is split between a Next.js 16 frontend that handles UI and CesiumJS 3D rendering, and a network of plugin data seeders that stream live updates via WebSockets.

The core design philosophy is the "All-Bundle Model," where plugins are dynamically imported at runtime as ES module bundles (`Dynamic CDN Loaded`). The frontend maintains a modular state architecture using Zustand, routing high-frequency data updates through a custom `DataBus` singleton to avoid React render cycle bottlenecks.

## Component Map
- **Frontend App Shell:** Next.js App Router providing layout and base API routes (in `src/app/`).
- **Globe Rendering Engine:** CesiumJS wrapped in Resium, responsible for 3D primitive and model rendering (in `src/core/globe/`).
- **State Management:** Zustand slice-based architecture (in `src/core/state/`).
- **Data Pipeline:** Custom event bus (`DataBus`) and WebSocket clients (`DataBusSubscriber`) routing live data to state (in `src/core/data/`).
- **Plugin System:** Registration, lifecycle management, and ES module loaders (in `src/core/plugins/`).
- **Database Layer:** Prisma ORM connecting to local SQLite or cloud PostgreSQL (in `prisma/`).

## Key Files
- `src/core/plugins/PluginManager.ts` - The PluginManager class. Core registry that instantiates plugins, calls `initialize()`, and handles lifecycle events.
- `src/core/plugins/loaders/InstalledPluginsLoader.ts` - Dynamically fetches and imports `import(/* webpackIgnore: true */ ...)` marketplace plugins into the environment.
- `src/core/data/DataBus.ts` - Custom typed event bus singleton that routes high-frequency data around the application.
- `src/core/globe/GlobeView.tsx` - The main Cesium viewer container, handling imagery layers, cameras, and primitive collections.
- `src/core/state/store.ts` - The main Zustand store registry linking the nine state slices (globe, layers, timeline, ui, filter, data, config, favorites, geojson).

## Data Flow
Real-time data follows a strict unidirectional stream optimized for sub-second updates:

1. **Engine Push:** A remote data engine pushes state over WebSocket (`/stream`) from either local seeders (`ws://localhost:5001/stream`) or the cloud fallback (`wss://dataengine.worldwideview.dev/stream`).
2. **WebSocket Client Router:** `WsClient.handleMessage()` receives the payload and pipes it to the event bus.
3. **DataBus Emission:** The bus fires `DataBus.emit("websocketData", WsStreamPayload)`.
4. **State Hydration:** The `DataBusSubscriber` component listens to the bus and calls `_hydrateSnapshot()` to update the Zustand store's `entitiesByPlugin` cache.
5. **Memoized Selection:** `GlobeView` selects the visible entities from the store.
6. **Primitive Rendering:** The `EntityRenderer` translates store entities into Cesium `PointPrimitiveCollection` and `BillboardCollection` arrays for GPU rendering.
7. **Animation & LOD:** `AnimationLoop` handles horizon culling and hover effects, while `useModelRendering` promotes close-range entities to 3D glTF models.

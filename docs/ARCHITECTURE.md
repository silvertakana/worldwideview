<!-- Generated: 2026-04-19 15:23:00 UTC -->
# System Architecture

WorldWideView operates on a decoupled Core-and-Plugin architecture. The central platform provides the 3D globe, HUD, timeline, and rendering optimizations, while separate intelligence domains are entirely handled by external plugin packages that are bundled and ingested at runtime.

The underlying data backbone uses a WebSocket Firehose, streaming continuous high-frequency metrics from standalone data engine microservices perfectly isolated from the visualization layer.

## Component Map
- **UI Platform:** `src/components/layout/AppShell.tsx`
- **3D Visualizer:** `src/core/globe/GlobeView.tsx`
- **State Store:** `src/core/state/globeSlice.ts` and peers.
- **Event Bus:** `src/core/data/DataBus.ts`
- **Microservice Connectors:** `packages/wwv-plugin-sdk/src/PluginManifest.ts`

## Key Files
- `src/core/globe/GlobeView.tsx` (lines 60-150): The central CesiumJS ingestion point and scene orchestrator.
- `src/core/globe/EntityRenderer.tsx` (lines 45-120): High-performance batched Primitive mapping for geometric entities.
- `src/core/plugins/PluginManager.ts` (lines 20-100): Validates and bootstraps compiled ES Modules from CDN/local sources.

## Data Flow
The real-time data flow triggers globally via WebSockets:
1. `src/lib/WsClient.ts` captures the socket frame from `dataengine.worldwideview.dev`.
2. Emits payload through `src/core/data/DataBus.ts` (lines 30-50).
3. The `DataBusSubscriber.tsx` hook catches the event, sanitizing and merging the data into `src/core/state/dataSlice.ts`.
4. `EntityRenderer` automatically reacts to State changes, triggering low-level Cesium Primitive re-draws against the GPU.

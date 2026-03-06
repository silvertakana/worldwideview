# System Architecture

WorldWideView is a high-performance, event-driven geospatial intelligence engine. It is designed to ingest live, fast-moving signals—such as aviation ADS-B, maritime AIS, or satellite feeds—and transform them into cinematic, real-time visual layers on a 3D globe.

## Module Breakdown

1. **`src/core/plugins`**: The registration and lifecycle management layer. Defines how plugins are booted and destroyed.
2. **`src/core/data`**: The "Heartbeat" of the system.
   - **DataBus**: Decentralized event pipeline for all system actions.
   - **PollingManager**: Intelligent scheduler for external API calls with backoff logic.
   - **CacheLayer**: 2-stage persistent caching (In-Memory + IndexedDB).
3. **`src/core/globe`**: The Rendering Engine.
   - **Cesium Integration**: Low-level control over the Cesium Viewer.
   - **EntityRenderer**: High-performance "Primitive" renderer.
4. **`src/plugins`**: Domain-specific logic (Aviation, Maritime, etc.).

## Performance: Primitives vs. Entities

One of our core design decisions is using **Cesium Primitives** instead of the standard high-level **Entity API** for high-count datasets.

| Feature | Entity API | Primitive API (WWV) |
|---|---|---|
| **Abstration** | High (Easy to use) | Low (Direct GPU access) |
| **Overhead** | Significant per-entity JS objects | Minimal (Batched rendering) |
| **Max Capacity** | ~1,000 entities | **100,000+ points/billboards** |
| **WWV Use Case** | Info window content | Live data point visualization |

**Why?** The Entity API in Cesium is great for rich features but triggers significant CPU overhead when managing thousands of moving objects. By using `PointPrimitiveCollection` and `BillboardCollection`, WorldWideView batches these draw calls, ensuring 60FPS even with dense global data.

## Data Pipeline (Example: Aviation)

The following diagram trace the journey of a single data point from a remote sensor to the user's screen:

```mermaid
sequenceDiagram
    participant S as Remote API (e.g. OpenSky)
    participant P as Plugin (AviationPlugin)
    participant D as DataBus
    participant R as EntityRenderer
    participant G as GPU (Cesium)

    Note over S, P: Polling Interval (e.g. 30s)
    S->>P: raw JSON data
    rect rgb(200, 230, 255)
    Note right of P: Mapping to GeoEntity
    P->>P: parse, filter, sanitize
    end
    P->>D: emit("dataUpdated", { entities })
    D->>R: trigger render cycle
    rect rgb(255, 230, 200)
    Note right of R: Batch Update Primitives
    R->>G: update collection buffer
    end
    G-->>G: 60FPS visualization
```

## Design Principles

- **Single Responsibility (SRP)**: Plugins only handle data mapping; they don't know about the UI or the Cache.
- **Dependency Inversion**: The `PluginManager` communicates with plugins through the `WorldPlugin` interface, allowing new plugins to be added without modifying core code.
- **Event-Driven Architecture**: The system is reactive. Components subscribe to what they need, reducing prop-drilling and unnecessary re-renders.
- **Defensive Programming**: All external API calls in plugins are wrapped in error boundaries and handled by the `PollingManager`'s backoff logic to prevent system-wide failures.

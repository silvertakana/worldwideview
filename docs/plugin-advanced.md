<!-- Generated: 2026-04-23 06:11:00 UTC -->
# Advanced Plugin Guide

This guide covers complex architectures, real-time telemetry streaming, and the deployment lifecycle for WorldWideView plugins. If you haven't built a basic plugin yet, start with the **[Quickstart](plugin-quickstart.md)**.

## Architecture Paradigm: The All-Bundle Model

WorldWideView operates on a strict **Dynamic CDN Loaded (Bundle)** architecture. 

> [!WARNING]
> **Deprecation Notice:** The legacy `StaticDataPlugin` (GeoJSON loaders) and `DeclarativePlugin` runtimes are fully deprecated. All new plugins must be dynamically imported at runtime as ES module bundles via `import(/* webpackIgnore: true */ entry)`.

### How Plugins Load
1. A user clicks "Install" in the **Marketplace**.
2. The marketplace sends the plugin manifest (containing an ES Module CDN URL, like `unpkg.com`) to the WorldWideView database.
3. At runtime, the `InstalledPluginsLoader` dynamically fetches the JavaScript bundle.
4. The plugin is instantiated, and its `initialize(ctx)` method is invoked.

## Real-Time Data: Bring Your Own Backend (BYOB)

Relying on the frontend `fetch()` method is insufficient for high-frequency real-time tracking (like aviation or maritime). For continuous telemetry, you must build a **Data Engine Seeder** — a containerized backend microservice.

### Microservice Seeder Architecture
Instead of the frontend fetching data, your backend container connects to an upstream source, normalizes the data, and publishes it to the central Redis stream managed by `wwv-data-engine`.

1. **Scaffold a Backend:** Use the CLI to generate a backend template.
   ```bash
   npx @worldwideview/cli create-backend my-plugin-backend
   ```
2. **Containerize:** This generates a Fastify Node.js server with a `Dockerfile` and `docker-compose.yml`.
3. **Publish to Redis:** Your backend polls the external API (e.g., ADS-B Exchange) and pushes snapshots to the WorldWideView Redis pipeline.
4. **WebSocket Delivery:** The central `wwv-data-engine` immediately broadcasts these updates over WebSockets to all connected clients.

> [!TIP]
> **Debugging WebSockets:** If your frontend isn't receiving data from your backend seeder:
> 1. Check the `wwv-data-engine` logs to ensure your seeder is publishing to Redis successfully.
> 2. Verify the frontend is connected to the correct WebSocket endpoint. Local instances default to `ws://localhost:5001/stream`, while unrecognized seeders fall back to the cloud at `wss://dataengine.worldwideview.dev/stream`.

## Advanced Cesium Rendering

When returning `CesiumEntityOptions` in `renderEntity(entity)`, you have direct access to the 3D engine's capabilities.

### 3D Models vs. Billboards (LOD Strategy)
To maintain 60 FPS with tens of thousands of entities, use WorldWideView's Level of Detail (LOD) promotion system.
- Render distant entities as simple `billboard` or `point` primitives.
- When the camera gets close, the system's `useModelRendering` hook can promote the entity to a full 3D glTF model.

```typescript
renderEntity(entity: GeoEntity): CesiumEntityOptions {
  return {
    type: "billboard", // Primary lightweight renderer
    color: "#ffffff",
    iconUrl: "https://unpkg.com/my-plugin/assets/icon.png",
    iconScale: 0.5,
    // Provide a 3D model URL. The engine will swap it in automatically at close range.
    modelUrl: "https://unpkg.com/my-plugin/assets/model.glb",
    modelScale: 1.0,
    heading: entity.heading,
  };
}
```

> [!CAUTION]
> **GPU Clipping Bug:** NEVER mix `size`, `outlineWidth`, or `outlineColor` properties onto an entity of `type: "billboard"`. This will cause the WebGL compiler to panic and result in severe visual clipping artifacts. 

## Publishing to the Marketplace

To distribute your plugin globally:

1. **Publish to NPM:**
   ```bash
   npm publish --access public
   ```
2. **Submit:** Navigate to `https://marketplace.worldwideview.dev/submit`.
3. **Register:** Enter your NPM package name. The marketplace automatically scrapes your `package.json` for the required `"worldwideview"` object block (containing your `id`, `icon`, and `category`).
4. **Review:** Once approved, your plugin's ES Module bundle will be served via CDN to all WorldWideView instances worldwide.

### Debugging Marketplace Submissions
- **"Invalid Manifest" Error:** Ensure you are using `@worldwideview/wwv-plugin-sdk` as a `peerDependency` (not a direct dependency) so the host application injects the context correctly.
- **Icon Not Showing:** Icons must be valid Lucide icon strings (e.g., `"Plane"`, `"Anchor"`).

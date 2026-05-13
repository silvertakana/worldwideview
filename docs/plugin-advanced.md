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

Relying on the frontend `fetch()` method is insufficient for high-frequency real-time tracking (like aviation or maritime). For continuous telemetry, you must build a **Data Engine Seeder** — a lightweight Javascript data polling script.

WorldWideView is a completely agnostic renderer. It has absolutely no concept of a "unified" Data Engine. If 30 plugins require 30 different WebSocket servers, the application will blindly open 30 connections. Each plugin is a self-contained package and **MUST explicitly declare its own `streamUrl` in its manifest or config**. Do NOT assume the frontend acts as a unified pipe.

While you can host your own backend, we provide the `DataEngineV2` runner as a standardized environment for seeders.

### Data Engine V2 Seeder Architecture
Instead of the frontend fetching data, you write a lightweight seeder script that connects to an upstream source, normalizes the data, and is executed by the central `wwv-data-engine-v2` host runner.

1. **Create a Seeder Directory:** Inside your WorldWideView project, create a folder under `local-seeders/` (e.g., `local-seeders/community/my-plugin/`). Note that seeders are split into `community` and `private` tiers to prevent namespace collisions.
2. **Write the Seeder Script:** Create a `seeder.mjs` file that exports a `fetch(ctx)` function.
3. **Engine Auto-Discovery:** The local Docker-based `wwv-data-engine-v2` automatically mounts this directory, discovers your script, and runs it on the defined interval.
4. **WebSocket & REST Delivery:** Seeders in V2 expose both a WebSocket stream (`/stream`) for real-time instantaneous updates, and a REST API endpoint (`/api/:id`) for fetching live data snapshots directly from Redis.

### Dependency Management & Monorepo Hoisting
Seeders within `local-seeders/` are strictly orchestrated within the pnpm workspace. They are executed by the central runner, not as standalone applications.
- **Keep `package.json` clean**: Do not include bulky `dependencies` in your seeder's local `package.json` (unless it's an exceptional, bespoke library).
- **Workspace Resolution**: Standard packages (e.g., `zod`, `ws`, `node-cron`, `undici`) are provided by the engine. At runtime, `wwv-data-engine-v2` leverages native Node.js module resolution to fetch the required dependencies directly from the root workspace or its own containerized runtime. Seeders MUST NOT bundle these dependencies.
- **Lightweight by Design**: This dependency orchestration guarantees that seeders remain extremely lightweight, hot-reloading takes milliseconds, and Docker container size stays optimized.

> [!TIP]
> **Debugging WebSockets:** If your frontend isn't receiving data from your backend seeder:
> 1. Check the `wwv-data-engine-v2` logs to ensure your seeder is publishing to Redis successfully.
> 2. Verify the frontend is connected to the correct WebSocket endpoint. Local instances default to `ws://localhost:5001/stream`, while unrecognized plugins should explicitly define their own `streamUrl`, or fallback to the cloud at `wss://dataenginev2.worldwideview.dev/stream`.

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
   Log in to NPM and publish your package using the WWV CLI from the project root (you can also use the `--org` flag to publish under your own NPM organization):
   ```bash
   npm login
   node packages/wwv-cli/dist/index.js publish <plugin-name> [--org <your-org>]
   ```
   *(Or `npx wwv publish <plugin-name> [--org <your-org>]` if installed globally)*
2. **Submit:** Navigate to `https://marketplace.worldwideview.dev/submit`.
3. **Register:** Enter your NPM package name. The marketplace automatically scrapes your `package.json` for the required `"worldwideview"` object block (containing your `id`, `icon`, and `category`).
4. **Review:** Once approved, your plugin's ES Module bundle will be served via CDN to all WorldWideView instances worldwide.

### Debugging Marketplace Submissions
- **"Invalid Manifest" Error:** Ensure you are using `@worldwideview/wwv-plugin-sdk` as a `peerDependency` (not a direct dependency) so the host application injects the context correctly.
- **Icon Not Showing:** Icons must be valid Lucide icon strings (e.g., `"Plane"`, `"Anchor"`).

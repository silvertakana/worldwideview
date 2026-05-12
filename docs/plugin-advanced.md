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
   In your plugin terminal, log in to NPM and publish your package using the WWV CLI:
   ```bash
   npm login
   node ../../packages/wwv-cli/dist/index.js publish
   ```
   *(Or `npx wwv publish` if installed globally)*
2. **Submit:** Navigate to `https://marketplace.worldwideview.dev/submit`.
3. **Register:** Enter your NPM package name. The marketplace automatically scrapes your `package.json` for the required `"worldwideview"` object block (containing your `id`, `icon`, and `category`).
4. **Review:** Once approved, your plugin's ES Module bundle will be served via CDN to all WorldWideView instances worldwide.

### Debugging Marketplace Submissions
- **"Invalid Manifest" Error:** Ensure you are using `@worldwideview/wwv-plugin-sdk` as a `peerDependency` (not a direct dependency) so the host application injects the context correctly.
- **Icon Not Showing:** Icons must be valid Lucide icon strings (e.g., `"Plane"`, `"Anchor"`).

## On-Demand Server-Side Work: Plugin Backends

The Data Engine Seeder model above handles **batch / interval** server work: poll a source, normalise, snapshot to Redis, broadcast. It doesn't fit **request/response** patterns the frontend can't safely do itself — per-entity lookups, 302 redirects, OAuth flows, webhook receivers, CORS-strict third-party APIs. The browser blocks those for good reason, and the host's core Next.js API isn't the right home for plugin-specific endpoints either.

For that, plugins ship a **backend**: a Node process supervised by the host, listening on a localhost port, reached by the frontend via a same-origin proxy.

### Opting In

Declare a `backend` block in your plugin's `package.json`:

```json
{
  "worldwideview": {
    "id": "myplugin",
    ...,
    "backend": {
      "entry": "backend/server.mjs",
      "port": 5101
    }
  }
}
```

- `entry` is required, resolved relative to the package root.
- `port` is optional. Without it the supervisor assigns a deterministic port from `hash(pluginId) % 100 + 5100` (range 5100–5199 reserved for plugin backends).

### Backend Contract

Your backend is just a Node process. Use Fastify, hono, express, or built-in `http` — the supervisor doesn't care, as long as you honour:

- Listen on `process.env.PORT`.
- Bind to `process.env.HOST` (always `127.0.0.1`; the host's authenticated proxy is the only ingress).
- `process.env.PLUGIN_ID` is set to your plugin id for logging convenience.
- Handle `SIGTERM` and `SIGINT` for graceful shutdown.
- Exit code `0` means "intentional shutdown, don't restart". Any non-zero exit triggers exponential-backoff restart (1s → 30s cap, reset after 60s of uptime).

Minimum viable example (zero external deps):

```javascript
// backend/server.mjs
import { createServer } from "http";

const PORT = Number(process.env.PORT);
const HOST = process.env.HOST ?? "127.0.0.1";

const server = createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/hello") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ msg: "hello from my plugin" }));
        return;
    }
    res.writeHead(404).end();
});

server.listen(PORT, HOST, () => console.log(`listening on ${HOST}:${PORT}`));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
```

### Reaching the Backend from the Frontend

Same-origin: `fetch("/api/plugin/<your-plugin-id>/<your-path>", ...)`.

The host's Next.js proxy at `src/app/api/plugin/[id]/[...path]/route.ts` reads the runtime registry written by the supervisor (`.plugin-backends.json`) and forwards your request to the right localhost port. **No CORS, no port discovery in the plugin bundle.** Cookies pass through naturally.

```typescript
// In your plugin's frontend bundle:
const res = await fetch("/api/plugin/myplugin/hello", { credentials: "include" });
const body = await res.json();
```

### Orchestration

- **Dev:** `pnpm dev` runs the supervisor concurrently with `next dev` (script `dev:plugin-backends`). Crashes auto-restart with backoff. Logs are prefixed `[plugin:<id>]`.
- **Prod:** `docker-entrypoint.sh` launches the supervisor in the background before the Next.js server. One container, no compose changes required for the base case. If a plugin needs resource limits or isolation, the supervisor can be moved into its own compose service later — the registry file makes this swap mechanical.

### When to Use a Backend vs. a Seeder

| Need                                                     | Use            |
| -------------------------------------------------------- | -------------- |
| Bulk data refreshed on an interval                       | Seeder         |
| WebSocket push of new entities                           | Seeder         |
| Per-id lookup on demand                                  | **Backend**    |
| Following a third-party 302 / proxying audio bytes       | **Backend**    |
| OAuth dance / webhook receiver                           | **Backend**    |
| One-shot fetch the frontend can do directly              | Neither        |

A plugin can ship both — they're orthogonal. The seeder handles the bulk index, the backend handles the per-entity lookups.

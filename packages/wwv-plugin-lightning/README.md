# wwv-plugin-lightning

Real-time global lightning strikes for WorldWideView, sourced from the community
[Blitzortung.org](https://www.blitzortung.org/) detection network and rendered as bright
flashes that fade out on the globe.

| | |
|---|---|
| **id** | `lightning` |
| **category** | `weather` |
| **format** | `bundle` |
| **data** | Blitzortung.org WebSocket (no API key) |
| **render** | fading `PointPrimitive` flashes (white → yellow → orange → transparent) |

## How it works

```
Blitzortung ws1–ws8  ──►  seeder backend  ──►  host WsClient  ──►  LightningPlugin
 (compressed JSON)      (backend/index.mjs)    (streamUrl)       .mapWebsocketPayload()
                                                                       │
                                          emit "lightning:strike" ─────┼──► LightningLayer  (fading flashes)
                                          on the WWV DataBus           └──► LightningPanel  (60s counter)
```

1. **Seeder backend** (`backend/`) holds one upstream connection to Blitzortung
   (round-robin `ws1`–`ws8`, auto-reconnect), sends the global subscription `{"a":111}`,
   decodes each (LZW-compressed) strike, keeps a
   rolling buffer of the last **2000**, and re-broadcasts batches to the frontend as
   `{ type: "data", pluginId: "lightning", payload: [{ id, lat, lon, timestamp }] }`.
   It is the endpoint the manifest's `streamUrl` points at.
2. The host **`WsClient`** connects to `streamUrl` and calls
   `LightningPlugin.mapWebsocketPayload`, which emits every strike on the WWV
   **DataBus** as a `lightning:strike` event (`{ id, lat, lon, timestamp }`) and returns
   a rolling 2000-entity buffer to the store.
3. **`LightningLayer`** (`getGlobeComponent`) subscribes to `lightning:strike` and draws
   each strike in a `PointPrimitiveCollection`, animating opacity/colour over ~3s and
   evicting the oldest beyond 2000. Default point rendering is disabled
   (`disableDefaultRendering`) so this layer fully owns the visuals.
4. **`LightningPanel`** (`getBottomPanelComponent`) subscribes to the same event and
   shows a live count of strikes in the last 60 seconds.

## Running the seeder

```bash
# from the repo root, after pnpm install
node packages/wwv-plugin-lightning/backend/index.mjs
# or:  pnpm --filter @worldwideview/wwv-plugin-lightning-backend start
```

Defaults to `ws://localhost:5005/stream`. Override the port with
`LIGHTNING_SEEDER_PORT`. Point the frontend at a different seeder by setting
`NEXT_PUBLIC_WWV_PLUGIN_LIGHTNING_STREAM_URL` (exposed to the plugin as
`ctx.env.LIGHTNING_STREAM_URL`). In production use a `wss://` URL — browsers block
insecure `ws://` from an `https://` page.

## Building

```bash
pnpm install                                        # from repo root
pnpm --filter @worldwideview/wwv-plugin-lightning build      # → dist/frontend.mjs (manifest entry)
pnpm --filter @worldwideview/wwv-plugin-lightning typecheck
```

The bundle externalizes React, Cesium, the SDK and the host DataBus to
`globalThis.__WWV_HOST__` via `wwvPluginGlobals()`, so it shares the host's singletons.

## Platform notes

This plugin uses the `lightning:strike` DataBus event. Custom namespaced plugin events
(`"<domain>:<event>"`) are supported by the SDK's `DataBusEvents` map, and the host
DataBus singleton is exposed to bundles via `@/core/data/DataBus`. The `weather`
category was added to the SDK's `PluginCategory` union for this layer.

## Attribution

Lightning data © the [Blitzortung.org](https://www.blitzortung.org/) contributors. The
network is volunteer-run for non-commercial use — keep attribution visible (the panel
shows it) and review Blitzortung's terms before any commercial deployment.

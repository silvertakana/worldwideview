# wwv-plugin-lightning-backend

Seeder backend for the [`wwv-plugin-lightning`](../README.md) layer. It bridges the
[Blitzortung.org](https://www.blitzortung.org/) realtime lightning network to a
WorldWideView-compatible WebSocket stream.

## Behaviour

- Opens one upstream WebSocket to Blitzortung, round-robining `ws1`–`ws8` and
  reconnecting with exponential backoff.
- Subscribes to the global realtime feed with `{"a":111}` (the live `ws*` endpoints
  stream the whole world from this message; a bounding-box message is ignored).
- Parses each frame as JSON, falling back to the network's LZW-compressed format.
- Keeps a rolling buffer of the last **2000** strikes and replays the most recent ~200
  to each newly-connected client.
- Broadcasts batched strikes every 500 ms as
  `{ type: "data", pluginId: "lightning", payload: [{ id, lat, lon, timestamp }] }`.

## Run

```bash
node index.mjs
# or
pnpm --filter @worldwideview/wwv-plugin-lightning-backend start
```

| Env var | Default | Purpose |
|---|---|---|
| `LIGHTNING_SEEDER_PORT` | `5005` | Port for the downstream `/stream` endpoint |

Listens on `ws://localhost:<port>/stream`. Front it with TLS (`wss://`) for any
non-local deployment.

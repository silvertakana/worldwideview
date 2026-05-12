# wwv-plugin-radio-garden

Listen to local radio anywhere — drag the globe over a city and a station
broadcasting from there starts playing. Built on Radio Garden's place index
(~12,500 cities worldwide). Hover or click — your choice.

## Components

This plugin ships two pieces:

- **Frontend bundle** (`dist/index.mjs`) — the standard WorldWideView plugin
  bundle. Loaded into the host at runtime via the marketplace / CDN flow.
- **Backend service** (`backend/server.mjs`) — a tiny Node HTTP server that
  the host's plugin-backend supervisor runs on a local port. Handles three
  things the frontend can't from the browser:

  1. Fetching the place list (1.8 MB, benefits from process-memory caching)
  2. Resolving per-place channel lists (response shape needs unwrapping)
  3. Following the 302 redirect on stream URLs (and optionally proxying
     audio bytes for broadcasters whose CORS is too strict for direct
     `<audio>` playback)

The frontend reaches the backend via the host's same-origin proxy at
`/api/plugin/radio-garden/<path>`. No CORS, no port discovery, no
mixed-content traps.

## Manifest

```json
{
  "worldwideview": {
    "id": "radio-garden",
    "name": "Radio Garden",
    "category": "custom",
    "icon": "Radio",
    "type": "data-layer",
    "capabilities": ["data:own", "ui:audio"],
    "backend": { "entry": "backend/server.mjs" }
  }
}
```

The `backend.entry` field opts the plugin into the third extension
dimension. The supervisor (`scripts/run-plugin-backends.mjs` in the host)
spawns the backend on a localhost port, restarts it on crash, and writes
the runtime registry that the proxy route reads.

## Behaviour

- **Click mode** (default) — click a city pin, the station plays.
- **Hover mode** — drag the globe; whatever city is nearest the camera
  target plays, with a 450 ms stability window to avoid churn.
- Crossfades over ~500 ms when switching stations.
- Volume / mute / mode persisted to `localStorage`.

## Credits

Data: [Radio Garden](https://radio.garden). API schema:
[community OpenAPI spec](https://jonasrmichel.github.io/radio-garden-openapi/).

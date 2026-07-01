# ADR-0006: On-Demand Plugin Compute via HTTP (Dual-Mode: WebSocket + REST on Data Engine)

## Status
Proposed

## Date
2026-06-13

## Related
- **Builds on:** ADR-001 (Decentralized Plugin Auth) — the same Ed25519 JWT used for WebSocket auth is reused for REST auth
- **Builds on:** `wwv-data-engine` seeder model — drop-in files in `seeders/<id>/` with `dist/index.mjs` (also discovers `dist/index.js` and `seeder.mjs`)

---

## Context

The data engine today supports **continuous push** via WebSocket: seeders poll on intervals, snapshot to Redis, and the engine broadcasts to subscribers.

This ADR adds a **second, coexisting mode — HTTP request/response** — without replacing or altering WebSocket streaming. Both run simultaneously on the same engine, same process, same container. Use cases for the HTTP mode:

- Per-entity lookup: "give me details for airport ICAO:KJFK"
- Search/query: "find vessels within 50km of this point"
- Data transformation: "aggregate aviation data by altitude band"
- Stateless processing algorithms that run once and return a result

These don't fit the continuous push model. They need request/response — a client sends input, the server computes, returns output.

The existing seeder contribution model is a key constraint: authors drop a file into `seeders/<id>/` and submit a PR to `wwv-data-engine`. The solution must follow the same pattern.

---

## Decision

### ADR-006A: Data Engine Exposes HTTP Endpoints for On-Demand Compute

The data engine mounts each seeder's `handle()` on a REST endpoint:

```
POST /api/:id/:path
```

**Client (browser or any HTTP client):**
```http
POST /api/aviation/search
Authorization: Bearer <JWT>
Content-Type: application/json

{ "query": "KJFK", "radiusKm": 50 }
```

**Server:**
```json
{
    "results": [...]
}
```

- The engine looks up the seeder for `:id`
- Calls `seeder.handle({ path, body, method })` with `path = "/search"`, `body = { query: "...", radiusKm: 50 }`, `method = "POST"`
- Returns whatever the handler returns (serialized as JSON)
- Handler can set status codes: `return { status: 200, body: { results } }` or `{ status: 404, body: { error } }`

### ADR-006B: Authentication via the Same JWT as WebSocket

The browser already receives JWTs for WebSocket connections. The same JWT is reused for REST:

```
Browser → GET /api/auth/ticket?pluginId=aviation → { token: "<JWT>" }
Browser → POST http://data-engine:5000/api/aviation/search
            Authorization: Bearer <JWT>
```

- No new auth mechanism. No proxy hop. No globe app involvement.
- The JWT is already in browser memory (cached by WsClient for 4.5 minutes)
- The engine's REST handler verifies the JWT using the same `verifyEngineToken()` used for WebSocket auth
- JWT is audience-bound per ADR-001B — the engine accepts JWTs with `aud: "wwv-data-engine"`

### ADR-006C: Seeder Exports an Optional `handle()` Function

Seeder modules export a `handle` function alongside the existing `fetch` / `fn` / `init`:

```javascript
// seeders/aviation/dist/index.mjs

// Existing seeder (interval polling)
export const name = "Aviation";
export const interval = 30_000;
export async function fetch(ctx) {
    const aircraft = await fetchAircraftState();
    return aircraft;
}

// New: on-demand compute handler
export async function handle(call, ctx) {
    // call = { path: "/search", method: "POST", body: { query: "KJFK" } }
    // ctx  = same seeder context: { redis }

    if (call.path === "/search" && call.method === "POST") {
        const aircraft = await ctx.redis.get("data:aviation:live");
        const results = filterByAirport(aircraft, call.body.query);
        return { status: 200, body: { results } };
    }

    return { status: 404, body: { error: "unknown path" } };
}
```

- `handle()` is optional — seeders without it only support subscribe/push
- `handle()` receives the same seeder context (`redis`)
- Returns `{ status, body, headers? }` — the engine serializes `body` as JSON
- Has direct access to Redis and live snapshots — no network calls
- Default timeout: 30 seconds (engine returns 504 if exceeded)

### ADR-006D: Same Contribution Model as Seeders

Both `fetch()` and `handle()` live in the same file in the same directory in the same repo:

```
wwv-data-engine/
  └── seeders/
        └── aviation/
              └── dist/
                    └── index.mjs      # exports fetch() + handle() (both optional)
```

A third-party plugin author:
1. Clones `wwv-data-engine`
2. Creates `seeders/<their-plugin>/dist/index.mjs`
3. Exports `fetch()` for polling, `handle()` for on-demand
4. Submits **one PR**

No new infrastructure. No supervisor, no port management, no registry file, no child processes. The package manager is already available for installing dependencies.

### ADR-006E: Registration at Startup

The engine auto-discovers seeder modules at startup (already implemented for `interval`/`cron` seeders). This is extended to extract and register the `handle` export:

```typescript
// server.ts — after existing seeder registration
if (typeof seederModule.handle === "function") {
    registerHandler(seederId, seederModule.handle, seederCtx);
}
```

The engine mounts the handler on the existing Fastify router. A catch-all route per plugin:

```typescript
// server.ts
server.route({
    method: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    url: "/api/:id/:path",
    handler: async (request, reply) => {
        // 1. Verify JWT
        const token = request.headers.authorization?.replace("Bearer ", "");
        const claims = await verifyEngineToken(token);

        // 2. Resolve handler
        const handler = getHandler(request.params.id);
        if (!handler) return reply.code(404).send({ error: "no handler for plugin" });

        // 3. Execute with timeout
        const result = await Promise.race([
            handler(
                {
                    path: "/" + request.params.path,
                    method: request.method,
                    body: request.body,
                    query: request.query,
                    headers: request.headers,
                },
                getSeederContext(request.params.id),
            ),
            timeout(30_000).then(() => ({ status: 504, body: { error: "timeout" } })),
        ]);

        return reply.code(result.status ?? 200).send(result.body);
    },
});
```

### ADR-006F: Handler Contract

Handlers are plain async functions. The engine wraps them in HTTP — the handler itself doesn't need Fastify, Express, or any HTTP framework.

```typescript
type SeederCall = {
    path: string;       // e.g., "/search" (the path segment after /api/:id)
    method: string;     // "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
    body: any;          // parsed JSON body (POST/PUT/PATCH)
    query: Record<string, string>;  // URL query parameters
    headers: Record<string, string>;  // forwarded request headers
};

type SeederCallResult = {
    status: number;     // HTTP status code (default 200)
    body: any;          // serialized as JSON response
    headers?: Record<string, string>;  // optional response headers
};

type HandleFn = (call: SeederCall, ctx: SeederContext) => Promise<SeederCallResult>;
```

---

## Consequences

**Positive:**

- Contribution model unchanged. One file, one directory, one PR.
- No new infrastructure (no ports, no supervisor, no child processes, no registry).
- Browser authenticates directly via JWT — already in browser memory from WebSocket flow.
- Handler has direct access to engine state: Redis, live snapshots.
- Same process, zero network latency for data access.
- Engine handles timeout, error boundary, JSON serialization — handler is just a function.
- Multiple HTTP methods supported (GET for simple queries, POST for complex bodies).
- Can be called from anywhere with JWT — browser, third-party integrations, internal tools.

**Negative / accepted tradeoffs:**

- Handler runs in the same process as the engine. A blocking or CPU-intensive handler affects engine throughput.
- No HTTP redirects (302). `handle()` returns structured data — not raw HTTP responses. Redirects and streaming audio/video are not supported by this model. Those use cases require a separate process model (e.g., PR #100's plugin backends).
- No per-handler resource limits. Mitigated by 30s timeout + the expectation that handlers are lightweight.
- Handler must not mutate shared state. If two concurrent calls modify the same Redis key, they race. Handlers should be pure functions over the data they consume.
- `path` routing is ad-hoc per plugin. The marketplace could later standardize a plugin path schema along with `handle()` as the implementation.

---

## Implementation Outline

1. **Data engine**: Add handler registration in `scheduler.ts` — extract `handle` from seeder module, store in `Map<pluginId, HandleFn>`
2. **Data engine**: Add Fastify route `POST /api/:id/:path` in `server.ts` with JWT auth + handler dispatch
3. **Data engine**: Add 30s timeout wrapper (`Promise.race`) + error boundary around handler calls
4. **wwv-plugin-sdk**: Add TypeScript types for `SeederCall` and `SeederCallResult`
5. **Frontend WsClient**: Add `callPlugin(pluginId, path, body)` method — reuses cached JWT from existing ticket flow
6. **`GET /api/auth/ticket`**: Already exists, already returns JWT to browser. No changes needed.

---

## Relationship to Existing Models

| | Seeder (interval) | On-Demand (this ADR) |
|---|---|---|
| **Communication** | Push (WebSocket broadcast) | REST (HTTP request/response) |
| **Auth** | JWT on WS connect | Same JWT in Authorization header |
| **Process** | Same as engine | Same as engine |
| **Contribution** | Drop-in file, PR to `wwv-data-engine` | Same file, same PR |
| **Use case** | Bulk data streams | Per-entity lookup, search, compute |
| **Container** | Data engine | Data engine |

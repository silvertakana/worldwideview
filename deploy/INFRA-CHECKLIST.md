# Production Infrastructure Checklist

Actions an operator must apply in Coolify (or equivalent) before public launch.
Complete every item and verify the /api/health response before opening traffic.

---

## 1. AUTH_SECRET

- [ ] Generate a high-entropy secret (minimum 32 bytes):
  ```bash
  openssl rand -hex 32
  ```
- [ ] Set it as `AUTH_SECRET` on the `wwv` service. This value MUST be distinct from
  `API_KEY_HMAC_SECRET`. The app fails closed (auth broken) if this is unset.

---

## 2. Redis

- [ ] Generate a Redis password:
  ```bash
  openssl rand -hex 32
  ```
- [ ] Set `REDIS_PASSWORD` on both the `wwv` and `wwv-redis` services to this value.
- [ ] For a co-located `wwv-redis`: the compose default uses this password automatically
  via `REDIS_URL=redis://:<password>@wwv-redis:6379`. No further URL override is needed.
- [ ] For a managed Redis provider (e.g. Upstash, Redis Cloud): set `REDIS_URL` to the
  provider's TLS endpoint instead:
  ```
  REDIS_URL=rediss://:<password>@<host>:<port>
  ```
  Use `rediss://` (double-s) for TLS. Remove the co-located `wwv-redis` service when
  using a managed provider.
- [ ] Verify Redis is reachable: `GET /api/health` should return `200` with
  `"redis": "ok"` (not `"degraded"`).

**What breaks without Redis:** MCP sessions, globe command queue, geocode cache,
all per-user and global rate limiters, and API key session tracking silently no-op
or degrade. The app stays up but MCP data tools report errors and OSM rate limits
are unenforceable.

---

## 3. Data Engine REST URL

- [ ] Set `WWV_DATA_ENGINE_URL` on the `wwv` service to the engine's REST base URL.
  This is the HTTP base (scheme + host + port). Do NOT include the `/stream` path:
  ```
  # Correct: REST base only
  WWV_DATA_ENGINE_URL=https://dataenginev2.worldwideview.dev

  # Wrong: do not include /stream
  # WWV_DATA_ENGINE_URL=https://dataenginev2.worldwideview.dev/stream
  ```
  The engine listens on internal port 5000 (`PORT=5000` in
  `deploy/production/docker-compose.engine.yml`) and publishes port 5000 on the
  host. The public URL `https://dataenginev2.worldwideview.dev` is reverse-proxied and
  needs no port. The code reads `WWV_DATA_ENGINE_URL` first in `getEngineUrl()`
  (`src/lib/data-query/service.ts`) and falls back to
  `http://localhost:5000` when it is unset.
  Replace `<engine-host-ip>` with the actual engine host IP or hostname visible from
  the `wwv` container.
- [ ] If the app and engine containers share a Docker network, use the service name:
  ```
  WWV_DATA_ENGINE_URL=http://wwv-data-engine:5000
  ```
- [ ] Verify reachability: `GET /api/health` should return `checks.engine: true`.
  A status of `"degraded"` with `checks.engine: false` means the URL is wrong or the
  engine is not running.

**What breaks without this:** All MCP data query tools (e.g. `query_plugin_data`)
report "engine unreachable" and return no data.

---

## 4. API Key HMAC Secret

- [ ] Generate a high-entropy secret (minimum 32 bytes):
  ```bash
  openssl rand -hex 32
  ```
- [ ] Set it as `API_KEY_HMAC_SECRET` on the `wwv` service. This value MUST be
  distinct from `AUTH_SECRET`. They serve different cryptographic purposes.
- [ ] cloud and demo editions fail closed without this value. The app will refuse to
  issue or validate API keys, blocking all MCP authentication.

---

## 5. Trusted IP Header (Cloudflare / CDN)

- [ ] If a CDN or second reverse proxy (e.g. Cloudflare) sits in front of your
  Nginx/Traefik reverse proxy, set:
  ```
  WWV_TRUSTED_IP_HEADER=cf-connecting-ip
  ```
  Without this, all clients share the proxy's IP address and collapse into a single
  rate-limit bucket. One user's burst exhausts the quota for all users.
- [ ] If you are NOT behind Cloudflare, leave `WWV_TRUSTED_IP_HEADER` unset (the
  default reads from `x-forwarded-for` via `x-real-ip`).
- [ ] Verify the correct client IP is visible in request logs or the
  `X-Client-IP` debug header (if enabled) after applying the setting.

---

## 6. Health Check Semantics

Configure your uptime monitor or Coolify health check against `GET /api/health`.

| Response | Meaning | Action required |
|---|---|---|
| `503` | Database or required config broken | Page on-call immediately |
| `200` with `status: "degraded"` | Redis or engine unreachable (`checks.redis`/`checks.engine` false) | Investigate; MCP features are impaired but core app is up |
| `200` with `status: "healthy"` (all checks `true`) | Fully healthy | No action |

Recommended alert rule: alert on any `503` immediately; alert on `200` degraded
after 5 consecutive checks (transient restarts are normal).

---

## Verification Sequence

Run these checks in order after applying all settings:

1. `GET /api/health` returns `200` with `status: "healthy"` and all checks `true`.
2. Sign in as an admin user, generate an MCP API key, and confirm the key is issued
   (cloud/demo: requires `API_KEY_HMAC_SECRET`).
3. Run `geocode_location({ query: "Paris" })` via the MCP endpoint and confirm
   results are returned (requires Redis + Nominatim reachability).
4. Run `query_plugin_data` for a live plugin and confirm data is returned (requires
   `WWV_DATA_ENGINE_URL`).

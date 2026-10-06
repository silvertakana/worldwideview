# ADR-0009: Engine-Direct Plugin Data Routing

## Status
Accepted

## Date
2026-08-24

## Related
- **Builds on:** ADR-0006 (On-Demand Plugin Compute via HTTP) — the engine's `/api/<id>` HTTP endpoint is the canonical data surface
- **Builds on:** ADR-0001 (Decentralized Plugin Auth) — WS stream auth via Ed25519 JWT tickets (hardening backlog: per-plugin claims, see Context)
- **Supersedes (in practice):** the legacy globe-side proxy route pattern (`src/app/api/<id>/route.ts` proxying a source server-side), which remains only for `wwv-plugin-earthquakes`, `wwv-plugin-iss`, `wwv-plugin-camera`

---

## Context

Dynamic data-layer plugins need live data. Two competing patterns existed:

1. **Globe-side proxy (legacy)**: the globe app defines `src/app/api/<id>/route.ts` that proxies a source server-side (e.g. `api/earthquake` → USGS), and the plugin fetches same-origin `/api/<id>`. Used by `wwv-plugin-earthquakes`, `wwv-plugin-iss`, `wwv-plugin-camera`.
2. **Engine-direct (modern)**: the plugin fetches the DATA ENGINE directly: `\`${this.context?.getEngineUrl() || "https://dataenginev2.worldwideview.dev"}/api/<id>\``. Used by `wwv-plugin-wildfire` and the engine-backed family (civil-unrest, conflict-events, market-tracker, marine-buoys, hurricane-storms, live-disasters, launch-tracker, ...).

Batch `dynamic-2026-08-24` initially scaffolded the four new plugins with the legacy relative-fetch pattern (mirroring the earthquakes reference), which broke on the demo globe (404/500 — no globe route for the new ids). The owner corrected the design: **the data route lives in the data engine; the plugin contacts the engine itself.**

Live evidence settled the question: the engine (`dataenginev2.worldwideview.dev`) CORS-allowlists `demo.worldwideview.dev` (preflight 204, ACAO reflects the demo origin), `GET /api/<id>` returns `{source, fetchedAt, items, totalCount}` with no auth, and the modern `wildfire` plugin — which fetches the engine directly from the browser — works on the demo today. The globe proxy routes were added (PR #449) then removed (PR #450) once the plugins were converted (PR #63, v1.0.1).

---

## Decision

**Dynamic data-layer plugins MUST fetch the data engine directly; the globe MUST NOT proxy plugin data.**

- Plugin `fetch()` resolves the engine base at runtime:
  ```ts
  const engineBase = this.context?.getEngineUrl() || "https://dataenginev2.worldwideview.dev";
  const res = await globalThis.fetch(`${engineBase}/api/<id>`);
  ```
  (`getEngineUrl()` is the plugin-context resolver injected by the globe from `NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL`; the `||` fallback also satisfies the repo URL linter.)
- `version = pkg.version` (import `../package.json`) — never a hardcoded literal.
- No new `src/app/api/<id>/route.ts` globe routes for dynamic plugins.
- Engine endpoints (`/api/<id>`, `/stream`) are the single data surface; seeders are the single data owners.

---

## Consequences

**Positive**
- One data owner; no per-deployment duplication of data-fetch logic.
- Plugins are self-contained and work on ANY globe (demo, self-hosted) pointing at any engine, as long as the engine URL resolves and CORS allows the globe origin.
- No globe redeploy needed when plugin data needs change.

**Negative / caveats (hardening backlog, owner review in progress)**
- The production engine currently behaves as an OPEN public data CDN (architecture review, 2026-08-24):
  - `GET /api/<id>` unauthenticated — anyone with the URL reads every seeder snapshot incl. private seeders (aviation, maritime, military-aviation, surveillance-satellites) when producing.
  - CORS reflects any origin (`ALLOWED_ORIGINS` unset → `['*']`).
  - Production runs `WWV_SKIP_WS_AUTH=true` — WS stream connects unauthenticated.
  - Per-plugin ticket scoping unimplemented (exchange drops `plugin_id`; JWT has no plugin claim; engine never checks scope).
  - No `Cache-Control` on `/api/<id>` (Cloudflare fronts but can't cache); rate limit mis-keyed (`fastify` no `trustProxy`).
- Self-hosted globes can't yet redirect a plugin's WS `streamUrl` via env (hardcoded streamUrl outranks env in `resolveEngineUrl` resolution order) — unification is a follow-up.
- `getEngineUrl()` (server-side `@/lib/data-query/service`) is a local-dev resolver (`http://localhost:5000`) and must NOT be used in globe route handlers; server-side engine calls use the env-chain pattern.

## References
- Review doc: internal research note `wwv-engine-direct-routing-review-2026-08-24.md` (maintainer-only, not tracked in this repo)
- Migration: wwv-plugins PRs #62/#63, worldwideview PRs #449/#450 (batch dynamic-2026-08-24)
- Skill doctrine: internal `plugin-mass-production` skill §1 (dynamic plugins) + §6-6f (maintainer-only, not tracked in this repo)

---

## Amendment — 2026-10-04: capability declaration convention and the sanctioned-route boundary

*This is an amendment: it adds a declaration convention and names the boundary. It does not rewrite the Decision above.*

### (a) Declaration convention

The capability list is now machine-checkable: the SDK exposes `PLUGIN_CAPABILITIES` as the single
source of truth (`PluginCapability` is derived from it) plus `isValidCapability()`, and
`src/core/plugins/validateManifest.ts` warns on any value outside it. A plugin declares HOW it
reaches its data:

- **Engine-backed layer** — declares `getServerConfig().streamUrl` (optionally a
  `dataSource.streamUrl` in its manifest) and contacts the data engine directly, per the Decision
  above. It does **not** declare `network:fetch`.
- **Browser-direct interactive tool** — declares `network:fetch`. The request runs in the user's
  browser against a third-party API that needs no secret.
- **Secret-holding upstream** — goes through a **sanctioned platform route**: a globe-app route or
  a data-engine endpoint that the platform owns, reviews, and rotates the secret for. A
  **per-plugin route on the globe app is never the answer** — it reintroduces exactly the
  per-deployment duplication this ADR removed.

`data:read:<source>` names a specific upstream the plugin reads and stays a template family, not a
literal. `layer` is not a capability: it is a legacy manifest tag that most published plugin
packages still declare (counted 69 of 80 at the plugin repository's `origin/main`, 2026-09-26). It
therefore **warns and is accepted**; a hard reject is not possible until `layer` is migrated.

### (b) Where the rule actually stops

Sanctioned **platform** compute over **cached engine snapshots** is allowed and in scope:
haversine proximity search, regional clustering, and anything else the platform computes over data
it already holds.

**Third-party plugin code running on the server is not allowed, under any spelling of that idea.**
No server-side plugin execution, no plugin-supplied route handler, no "plugin compute" hook, and no
relay that runs plugin code outside the browser. The browser stays the sole execution site for
plugin code (v3 frontend-relay design).

### (c) Secret-holding exception list (as it stands)

| Route | Upstream secret it holds |
| --- | --- |
| `places/*` | Google Maps key (`GOOGLE_MAPS_API_KEY`, per-user key when supplied) |
| `weather/tile` (and `weather/layers`) | OpenWeatherMap key (`OPENWEATHERMAP_API_KEY`) |
| the camera family (`camera/*`) | per-camera upstream credentials (`NY511_API_KEY`, `WSDOT_API_KEY`, ...), until migrated |

These are the only sanctioned secret-holding globe routes. Anything not on this list must not add
another one.

### (d) Direction of travel

The **data engine** is the long-term home for secret-holding **data** layers: the engine owns the
secret, the seeder owns the data, and the plugin reads a snapshot or a stream. The globe app's
remaining secret-holding routes in (c) are **transitional** and should move to the engine as each
upstream allows.

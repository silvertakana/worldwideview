# ADR-001 Consolidation Plan: Dual-Issue Path to Decentralized Plugin Auth

## Context

ADR-001 (`docs/architecture/decisions/adr-0001-decentralized-plugin-auth-and-ssrf-mitigation.md`, still marked **Proposed**) defines a decentralized auth model for plugin data streams: Ed25519-signed, 5-minute, audience-bound JWT tickets issued by the Marketplace and verified offline by each Data Engine using JWKS.

The current state is a partial, incoherent implementation across three repos. A recent attempt to land the Data-Engine half landed broken, took production down, and was rolled back. This plan consolidates everything required so the next attempt is **once-and-done** with a feature-flagged dual-issue strategy — the existing HS256 marketplace-session token keeps working untouched while a new Ed25519 data-plane ticket system is built end-to-end and flipped on per-plugin.

**Scope:** all three deployables — Local App (this repo), Marketplace (`marketplace.worldwideview.dev`), Data Engine (`wwv-data-engine-public`).

**Honest framing on "once and done":** this plan delivers **zero-downtime** but is **4–5 sequenced deploys across 3 repos**, not literally one deploy. Compressing the steps is exactly what caused the previous outage. Sequenced + dormant-flagged is the safest path that meets the no-downtime intent.

---

## Current State (what we found)

### ✅ Already in place
- **AES-256-GCM at rest** for credentials — `src/lib/auth/encryption.ts` (PBKDF2 100k, v1 versioning, nonce+salt in DB). Schema `MarketplaceCredential` at `prisma/schema.prisma:92-104`.
- **PKCE initiation** — `src/app/api/marketplace/connect/route.ts` (openid-client v6, S256, `__Host-` cookies).
- **PKCE callback** — `src/app/api/marketplace/callback/route.ts` (state check, encrypted persist). Tests at `src/app/api/marketplace/pkce.spec.ts`.
- **JWT claims type contract** — `packages/wwv-plugin-sdk/src/auth-contracts.ts` (`PluginJwtClaims`, `WebSocketAuthMessage`).
- **SSRF partial defenses** in the JSON proxy — `src/lib/security/ssrf.ts` (post-DNS private-IP block, pinned-IP agent, size/time limits) used by `src/app/api/camera/proxy/route.ts` and `stream/route.ts`.

### ⚠️ Half-finished / risky (must be resolved before any deploy)
1. `src/lib/marketplace/marketplaceToken.ts` — HS256, 4h, hard-coded `aud`. **Acceptable as the marketplace-session bridge token only**; must NOT be used as a data-plane ticket. C1 enforces this via branded types (`MarketplaceSessionToken` vs `PluginTicket`) so the compiler refuses misuse.
2. `src/app/api/marketplace/callback/route.ts:27-29` — currently calls a non-existent `/api/tickets/exchange` endpoint and casts `openid-client` config as `any`. A4 ships the correct endpoint as `/api/oauth/token`; C1 updates the callback URL and removes the cast. Suspected source of the previous deploy break.
3. `src/lib/auth/encryption.ts:9` — silent fallback to a zeroed key if `ENCRYPTION_MASTER_KEY` env var unset. Must throw at startup.
4. `src/app/api/camera/proxy/iframe/route.ts` — bypasses `safeFetch` entirely; raw `fetch` with default redirect-follow and no size cap.
5. No host allowlist on any proxy route (ADR-001D constraint 1) — accepts any HTTPS host.
6. `src/core/data/WsClient.ts:67-69` — sends `subscribe` immediately on `onopen`; no first-message auth, contract `WebSocketAuthMessage` is defined but unused.

### ❌ Missing entirely
- **Ed25519 keypair** + **JWKS endpoint** on the Marketplace.
- **Ticket-issuance endpoint** on the Marketplace (`POST /api/tickets/exchange` → returns 5-min EdDSA JWT for a named audience).
- **JWT verification** on the Data Engine (`@fastify/jwt` + `get-jwks`, audience binding, unknown-`kid` re-fetch, fail-closed cold start).
- **First-message auth handshake** on the Data Engine WebSocket (3s timeout, close code 4003, no re-auth, log redaction).
- **Marketplace-side PKCE token endpoint** that the Local App callback expects.
- **Origin / Host / TLS-state validation** on the Data Engine WS upgrade.
- ADR doc still `Proposed`; never moved to `Accepted`.

---

## Strategy: Dual-Issue, Feature-Flagged, Coordinated Cutover

Two token systems live side by side. **Nothing existing is removed in this phase.**

| Token | Algo | Lifetime | Issued by | Verified by | Purpose |
|---|---|---|---|---|---|
| Marketplace-session (existing) | HS256 | 4h | Marketplace | Marketplace API only | UI login session. **Unchanged.** |
| Plugin-ticket (new) | EdDSA / Ed25519 | 5 min | Marketplace | Each Data Engine via JWKS | Data-plane WebSocket auth. **New, flag-gated.** |

Canonical flag names used throughout this plan:
- **Client (Local App), per-plugin opt-in:** `NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS` (comma-separated plugin IDs).
- **Engine (Data Engine), per-plugin enforcement:** `REQUIRE_TICKET_AUTH_PLUGINS` (comma-separated).
- **Engine, global default-deny:** `REQUIRE_TICKET_AUTH` (boolean, default `false`).
- **Engine, Origin allowlist enforcement:** `ENFORCE_ORIGIN_ALLOWLIST` (boolean, default `false`).
- **Local App SSRF allowlist:** `PROXY_HOST_ALLOWLIST` (`*` sentinel, empty/unset = deny, or concrete list).

When all three engine flags are off, Data Engine accepts unauthenticated connections (today's behavior). When `REQUIRE_TICKET_AUTH_PLUGINS` includes a plugin, the client must send `{type:"auth", v:1, token}` first message and engine validates.

This means each repo can be deployed independently in the safe order below; the new code is dormant until the flag is flipped per-plugin.

---

## Workstreams

### A. Marketplace repo (separate codebase — produce a hand-off spec from this plan)
Deliverables the Marketplace team must ship:
1. **Ed25519 keypair generation + storage**, with overlap support (current + next `kid`).
2. `GET /.well-known/jwks.json` — public keys array, `Cache-Control: public, max-age=300`.
3. **Data-plane ticket exchange** — `POST /api/tickets/exchange` — body `{ api_key, audience, plugin_id }`; returns `{ token, expires_in: 300 }`. Claims per ADR-001B: `iss, sub, aud, exp, iat, jti, tier, scope`. Redis-backed `jti` issuance counter for rate-limiting; Postgres fallback per ADR failure-mode table.
4. Library: `jose` for sign + JWKS publication.

### A4. Marketplace API-Key sub-spec (gating workstream — must complete BEFORE step 2)

Pulled out of Workstream A because it is not a one-endpoint change. The Marketplace does not currently have an "API Key" concept — today's PKCE callback stores the OAuth `access_token` directly. A4 invents the API-Key end-to-end:
- New DB table for API Keys (device-bound, manually rotated per ADR-001C).
- `POST /api/oauth/token` — the PKCE token endpoint consumed by `src/app/api/marketplace/callback/route.ts:27`. Renamed from `/api/tickets/exchange` to avoid path collision with A3.
- API-Key issuance and rotation API.
- Rotation UI in the Marketplace (per ADR-001C).
- A4 is treated as its own workstream with its own sub-plan; do not bundle it into the A1–A3 deploy.

### B. Data Engine repo (`wwv-data-engine-public` — hand-off spec)

**SDK delivery mechanism (decide before B starts):** the Data Engine must consume the same `PluginJwtClaims` and `WebSocketAuthMessage` types that live in `packages/wwv-plugin-sdk` here. Pick one:
- **(Recommended)** Publish `wwv-plugin-sdk` to a private npm registry (or GitHub Packages) with a SemVer tag; Data Engine pins `^x.y.z`.
- Vendor a copy in Data Engine and add a CI check that diffs against the upstream SDK on push.
- Git submodule pointing at a tagged commit.

Drift between repos = silent audience-binding mismatches. Pick one before any Workstream B code lands.

Deliverables:
1. `@fastify/jwt` + `get-jwks` integration; LRU JWKS cache 5 min; unknown-`kid` triggers single background re-fetch then reject.
2. **Fail-closed cold start** — if JWKS unreachable on boot, refuse all connections. **Gated by `REQUIRE_TICKET_AUTH || REQUIRE_TICKET_AUTH_PLUGINS !== "" || ENFORCE_ORIGIN_ALLOWLIST`** — when no ticket auth is active (the dormant-deploy state), JWKS unreachable is non-fatal at boot; engine boots, retries fetch in background. Today's engine has no Marketplace boot dependency, and the dormant deploy must preserve that.
3. WS upgrade handler validates `Origin` (allowlist via env), `Host`, TLS state, expected tenant/plugin metadata. **Flag-gated by `ENFORCE_ORIGIN_ALLOWLIST` (default `false`)** so first deploy does not reject existing production clients. Flipped to `true` only after the allowlist has been populated and observed in logs (step 7).
4. **First-message auth state machine** — connection state `AWAITING_AUTH`; 3s timer; reject any non-auth frame; close 4003 on failure; promote to `AUTHENTICATED` on success; no re-auth.
5. Audience binding — reject if `aud !== process.env.ENGINE_ID`.
6. Log redaction — JWT payloads never serialized to logs.
7. Feature flag `REQUIRE_TICKET_AUTH` defaults `false`; production cuts over per-plugin. Separate from `ENFORCE_ORIGIN_ALLOWLIST` so the two protections can be rolled out independently.

### C. Local App (this repo — concrete file changes)

**C1. Cleanup & safety (must land first, no behavior change)**
- `src/lib/auth/encryption.ts:9` — throw on missing **`ENCRYPTION_MASTER_KEY`** (correct var name; not `MASTER_KEY`) instead of zero fallback. **Pre-deploy gate:** verify `ENCRYPTION_MASTER_KEY` is set in every Coolify environment (local-self-host template, cloud, demo) and in `.env.example` before merging this change — otherwise next deploy fails on boot.
- `src/app/api/marketplace/callback/route.ts:29` — replace `config as any` with proper `client.discovery()` once Marketplace publishes its discovery doc; until then, type the config explicitly.
- **Type-level separation instead of runtime guard:** Introduce branded types in `packages/wwv-plugin-sdk/src/auth-contracts.ts`:
  - `type MarketplaceSessionToken = string & { __brand: "marketplace-session" }`
  - `type PluginTicket = string & { __brand: "plugin-ticket" }`
  - `marketplaceToken.ts` signs/returns `MarketplaceSessionToken`; new `ticketClient.ts` returns `PluginTicket`; `WsClient`'s auth message accepts only `PluginTicket`. Compiler enforces the separation — no fragile runtime detection.
  - Add doc comment to `marketplaceToken.ts`: "Marketplace UI session only — NOT a data-plane ticket."
  - Existing consumers ([src/lib/marketplace/auth.ts](src/lib/marketplace/auth.ts), [install-redirect/route.ts](src/app/api/marketplace/install-redirect/route.ts), [grant-token/route.ts](src/app/api/marketplace/grant-token/route.ts)) continue to receive `MarketplaceSessionToken` — no behavior change.

**C2. SSRF hardening (ADR-001D)**
- Add `PROXY_HOST_ALLOWLIST` env var (comma-separated). Enforce in `src/lib/security/ssrf.ts` before scheme/IP checks. **Default behavior:**
  - `PROXY_HOST_ALLOWLIST="*"` → permissive (current behavior), logs a `WARN` per request naming the host so operators can populate the list from observed traffic. **Sentinel-based instead of relying on unset-vs-empty** because Coolify and similar PaaS UIs may send `""` for "unset."
  - `PROXY_HOST_ALLOWLIST=""` or unset → deny all (safe default).
  - `PROXY_HOST_ALLOWLIST="a.example,b.example"` → only those hosts allowed.
  Ship C2 with the var set to `*` in all environments; populate over a week of log observation; flip to a concrete allowlist in step 7c.
- `src/app/api/camera/proxy/iframe/route.ts` — route through `safeFetch`; add 5 MB size cap; reject redirects to non-allowlisted hosts (don't follow by default).
- Document the allowlist procedure in `.agents/context/environment-config.md`.

**C3. Ticket client (new, dormant behind flag)**
- New module `src/lib/auth/ticketClient.ts`: given a `pluginId` and the encrypted API Key from `MarketplaceCredential`, POSTs to Marketplace `/api/tickets/exchange`, caches the 5-min JWT in memory keyed by `(pluginId, audience)`, refreshes at 4.5 min.
- New hook `src/core/data/useTicket.ts` consumed by `WsClient`.

**C4. WebSocket first-message auth (client side)**
- `src/core/data/WsClient.ts:67-69` — when `ticketAuth` enabled for plugin, on `onopen` send `WebSocketAuthMessage` (from `auth-contracts.ts`) *before* any subscribe; queue subscribes until server `ack`.
- Add 3 s client-side auth timeout that closes and reconnects.

**C5. Feature flag**
- `src/core/edition.ts` — new flag `ticketAuthEnabledForPlugin(pluginId): boolean`, sourced from `NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS` (comma list) so we can enable one plugin at a time.

**C6. ADR status**
- Move `docs/architecture/decisions/adr-0001-...md:4` from `Proposed` to `Accepted` once Workstreams A/B/C land in their repos but BEFORE any plugin is flag-flipped.

---

## Parallelization: what runs concurrently vs sequentially

**Code writing — fully parallel.** Three agents can work in three repos simultaneously with zero file conflicts:
- Agent 1: Marketplace (`worldwideview-marketplace`, `feat/adr-001-marketplace`) — A1, A2, A3 fixes.
- Agent 2: Data Engine (`wwv-data-engine`, `feat/adr-001-data-engine`) — B1-B5 fixes.
- Agent 3: Local App (`worldwideview.feat-adr-001-local-app`, `feat/adr-001-local-app`) — C1, C2 first; then C3, C4, C5 once contract is confirmed.

The wire contract (POST body shape for `/api/auth/exchange`, JWT claim shape, WS first-message format) is already defined in `packages/wwv-plugin-sdk/src/auth-contracts.ts` and the existing Marketplace/Data Engine code — agents don't need to coordinate on it.

**Workstream A4 (Marketplace PKCE / API Key invention) can also run in parallel** with the other three, since it touches new files (`/api/oauth/token`, new Prisma model) and doesn't conflict with A1-A3. Treat it as a 4th parallel track.

**Deploys — must be sequenced** (this is the part that took down the previous attempt by compressing it). The order in the next section enforces that.

**Bottom line:** parallelize the *writing*, sequence the *shipping*.

## Deploy Order (zero-downtime sequenced choreography)

Steps 1–5 are individually deployable and dormant for the new ticket flow. **Step 1 introduces a hard `ENCRYPTION_MASTER_KEY` requirement** that the step-0 audit must confirm is satisfied — that is the riskiest item in the pre-ticket-cutover phase. Production behavior for ticket auth does not change until step 6.

0. **Pre-flight audit (before any code lands).** The previous failed deploy may have left debris. Audit and reconcile, producing an artifact at `docs/deploys/2026-MM-DD-adr-001-preflight.md` (use today's date) that records:
   - Coolify env vars on the Local App, Marketplace, and Data Engine services — list every `JWT_*`, `TICKET_*`, `JWKS_*`, `AUTH_*` var and decide keep/remove.
   - `wwv-data-engine-public` `main` branch — confirm the rolled-back state is clean (no half-merged `@fastify/jwt` wiring, no env-gated bypass middleware).
   - Any feature flags or dormant routes already in production from the prior attempt.
   - Confirm `ENCRYPTION_MASTER_KEY` is set on every environment (gate for C1).
   - Confirm decision on SDK delivery mechanism (gate for B).
   - Create `docs/feature-flags.md` listing all 5 flags introduced by this plan (`NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS`, `REQUIRE_TICKET_AUTH`, `REQUIRE_TICKET_AUTH_PLUGINS`, `ENFORCE_ORIGIN_ALLOWLIST`, `PROXY_HOST_ALLOWLIST`) with: which repo, default value, what each setting means, and a per-environment table (dev/staging/prod) the operator keeps current. Drift between staging and prod is a known paper-cut; the doc is the single source of truth.
   - Confirm A4 sub-spec (Marketplace API-Key invention) has its own plan and is on track — A4 must ship before step 2.

1. **Local App** ships C1 + C2 (cleanup + SSRF). Pure hardening, no protocol change. Verify and deploy.
2. **Marketplace** ships A1–A3 (Ed25519 keys, JWKS endpoint, data-plane ticket-exchange). **A4 must already be shipped** as a prerequisite (see Workstream A4 above) — confirmed in step 0. New endpoints only, no existing endpoint changes. Verify JWKS reachable.
3. **Local App** ships C3 + C4 + C5 (ticket client, first-message auth, flag) with flag set to `""` (empty = nothing enabled). Dormant. Deploy.
4. **Data Engine** ships B1–B7 with `REQUIRE_TICKET_AUTH=false` **and** `ENFORCE_ORIGIN_ALLOWLIST=false`. Both new verification paths exist but are dormant. Deploy.
5. **Smoke test in staging** — flip flag for one synthetic plugin only; verify end-to-end ticket → WS auth → stream → 5-min refresh → revocation latency.
6. **Cut over one real plugin at a time** by adding it to `NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS` and the engine's `REQUIRE_TICKET_AUTH_PLUGINS`. Monitor each for 24h before adding the next.
7. **Default-deny rollout — split into three independent steps with 24h soak between each** so attribution is clear if anything breaks:
   - **7a.** Set `REQUIRE_TICKET_AUTH=true` on the Data Engine. Soak 24h.
   - **7b.** Set `ENFORCE_ORIGIN_ALLOWLIST=true` on the Data Engine (after populating the Origin allowlist from observed connections). Soak 24h.
   - **7c.** Replace `PROXY_HOST_ALLOWLIST="*"` with the concrete observed list on the Local App. Soak 24h.
   Each step is independently revertable by flipping its single flag back.
8. **Accept** the ADR; schedule HS256 marketplace-session token review as a follow-up (out of scope here).

**Re-verification rule (anti-dormant-code rot):** between steps 3 and 5, run the staging smoke test (step 5) **weekly** if the cutover is paused. Dormant feature-flagged code rots — catching it weekly in staging beats finding it broken on cutover day.

Rollback at any step: remove the plugin from the env list. Old path is still wired up because we never removed it.

---

## Critical Files (this repo)

- `src/lib/auth/encryption.ts` — fix silent fallback (C1)
- `src/lib/security/ssrf.ts` — add host allowlist (C2)
- `src/app/api/camera/proxy/iframe/route.ts` — route via safeFetch (C2)
- `src/app/api/marketplace/callback/route.ts` — remove `as any` cast (C1)
- `src/lib/marketplace/marketplaceToken.ts` — guard against data-plane misuse (C1)
- `src/lib/auth/ticketClient.ts` — **new** (C3)
- `src/core/data/WsClient.ts` — first-message auth (C4)
- `src/core/edition.ts` — per-plugin flag accessor (C5)
- `packages/wwv-plugin-sdk/src/auth-contracts.ts` — already has the types, reuse
- `docs/architecture/decisions/adr-0001-...md` — status flip (C6)

---

## Verification

End-to-end (run in staging, gated by `NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS=test-synthetic`):

1. `pnpm test` — Vitest suite green including new tests for `ticketClient` and `WsClient` first-message flow.
2. `pnpm build` — no TS errors after removing the `as any` cast.
3. Manual: with engine `REQUIRE_TICKET_AUTH_PLUGINS=test-synthetic`, connect WS without auth message → engine closes with 4003 within 3 s.
4. Manual: valid ticket → stream flows; wait 4.5 min → client transparently refreshes; revoke API Key on Marketplace → next refresh fails, current stream finishes its 5-min window then disconnects (matches ADR revocation table).
5. Stop Marketplace → Data Engine cold-start refuses connections (fail-closed); restart Marketplace → connections resume.
6. SSRF: attempt `POST /api/camera/proxy` to a host not in `PROXY_HOST_ALLOWLIST` → 403. Attempt to a host resolving to 127.0.0.1 → 403.
7. Encryption fallback: unset `ENCRYPTION_MASTER_KEY`, start app → process refuses to start.

Deploy gate: all of the above pass in staging before step 6 of the deploy order touches any production plugin.

---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: Cloud Launch
status: completed
last_updated: "2026-06-11T04:43:19.313Z"
last_activity: "2026-06-11 — Phase 37 Plan 01 shipped: MarketplaceConnect component, callback error handling, connect-status page, encryption key validation, InstanceConfig deprecation banner"
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 1
  completed_plans: 1
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-03)

**Core value:** A single globe that shows everything happening in the world right now, extensible by anyone via plugins, and controllable by any AI agent via MCP.
**Current focus:** v1.6 Cloud Launch (Phase 37+) -- PKCE-based account connection, token management, and cloud deployment wiring.

## Current Position

Phase: 38 — E2E Smoke Test (complete)
Plan: 01 — E2E Smoke Test
Status: Plan 01 complete -- 1035 tests pass, build green; noCredential fallback, Playwright E2E script, smoke checklist
Last activity: 2026-06-11 — Phase 38 Plan 01 shipped: ticket route returns noCredential, WsClient graceful fallback, Playwright E2E script, manual smoke checklist

## Completed Phases (v1.5)

| Phase | Result | Commit |
|-------|--------|--------|
| 31 Transport Resilience | tsc + 916 tests + build green; security SAFE | 121f7b22 |
| 32 Security and Abuse-Resistance | tsc + 967 tests + build green; security MERGE-WITH-FIXES resolved | 3fd23473 |
| 33 Tool Honesty and Agent UX | tsc + 983 tests + build green; TOOL-01 live-verified (no_data_matches) | 813d2b28 |
| 34 Observability | tsc + tests + build green; /api/health probes redis/db/engine/config | b95ff5d5 |
| 35 Deployment Wiring | tsc + 1004 tests + build green; security MERGE-WITH-FIXES resolved (Redis auth, AUTH_SECRET, pg loopback) | 0f860185 |
| 36 Onboarding and Framing | tsc + 1004 tests + build green; quickstart + prerequisites + SESSION_REQUIRED_PREAMBLE on all 7 command tools | a5fade97 |

## Completed Phases (v1.6)

| Phase | Result | Commit |
|-------|--------|--------|
| 37 Account Connection UI | 1033 tests + build green; MarketplaceConnect component, callback error handling, connect-status page | 57fd018c |
| 38 E2E Smoke Test | 1035 tests + build green; noCredential fallback, Playwright E2E script, manual smoke checklist | b26b578f |

## v1.5 Phase Map (archived)

| Phase | Goal | Key requirements |
|-------|------|-----------------|
| 31 | Transport Resilience | TRANS-01, TRANS-02, TRANS-03, TRANS-04 |
| 32 | Security and Abuse-Resistance | SEC-01, SEC-02, SEC-03, SEC-04 |
| 33 | Tool Honesty and Agent UX | TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05 |
| 34 | Observability | OBS-01 |
| 35 | Deployment Wiring | DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04 |
| 36 | Onboarding and Framing | ONBRD-01, ONBRD-02, ONBRD-03 |

**Coverage:** 21/21 v1.5 requirements mapped, 0 orphaned.

## v1.6 Phase Map

| Phase | Goal | Key requirements |
|-------|------|-----------------|
| 37 | Account Connection UI | Marketplace PKCE connect button, error page, encryption validation |
| 38 | E2E Smoke Test | noCredential fallback, WsClient graceful degradation, Playwright E2E script, smoke checklist |

**Phase numbering:** v1.6 starts at Phase 37 (v1.5 ended at Phase 36).

**Locked decision (v1.5):** Command/control tools keep current behavior (they require a live signed-in browser session to drive the globe); a headless/render-on-demand globe is out of scope (deferred).

## v1.4 Phase Map (archived reference)

| Phase | Goal | Key requirements |
|-------|------|-----------------|
| 26 | Server Instructions + Orientation | INST-01, INST-02, INST-03, INST-04 |
| 27 | Tool Description Rewrite | DESC-01, DESC-02, DESC-03 |
| 28 | Smart Response Contracts + Favorites CRUD | RESP-01, RESP-02, CRUD-01 |
| 29 | Compound and Discovery Tools | TOOL-01, TOOL-02, TOOL-03 |
| 30 | Local Data-Source Bridge | D-01..D-08, RESP-01, TOOL-01, TOOL-02 |

## Key Decisions (carried from v1.2/v1.3/v1.4)

- **MCP transport:** Stateless Streamable HTTP at /api/mcp; raw @modelcontextprotocol/sdk; Bearer auth via authenticateApiKey(). No custom server.ts.
- **Redis for ephemeral state:** Globe state, command queues, session catalogs all in Redis. PostgreSQL for user-owned persistent data.
- **SSE command bridge:** EventSource-based push (GET /api/globe/commands/stream).
- **Plugin tools via frontend relay:** No engine endpoint. useMcpCatalogPublisher + useMcpRelayBridge pattern; plugin-relay blpop has a 10s window (relevant to TRANS-03 maxDuration).
- **Three editions:** NEXT_PUBLIC_WWV_EDITION (local/cloud/demo). isDemo gate runs before auth on all new endpoints.
- **Generic API keys:** wwv_prefix.secret bearer tokens. authenticateApiKey() middleware reused for all MCP tools.
- **LocalDataSource registry (Phase 30):** Manifest-declared registry making server-reachable static/client-side plugins MCP-queryable; per-source TTL cache (TTL_GEOJSON_MS=60min, TTL_ROUTE_MS=60s).
- **emptyReason enum (evolving in v1.5):** v1.4 contract was "plugin_not_streaming" | "no_data_matches" | "no_session_active". v1.5 TOOL-01/TOOL-05 require session-independent tools to return no_data_matches | engine_unreachable | no_active_plugins instead of no_session_active. Lock the revised enum in Phase 33 before rewriting MCP_SERVER_INSTRUCTIONS.
- **Nominatim rate limiting:** server-side Redis sliding window (1 req/sec) + 24h cache already live (v1.3 GEO-03). DEPLOY-03 elevates this to a single GLOBAL throttle (<=1 rps) protecting the shared geocoder -- do not re-implement per-request limiting.

## Blockers

None.

## Accumulated Context

### Roadmap Evolution

- v1.5 derived from a public-launch premortem of the MCP server. One phase per REQUIREMENTS.md category, 1:1 mapping.
- Phase numbering: v1.5 starts at Phase 31 (v1.4 ended at Phase 30). Do NOT renumber or reset.
- Dependency note: Phase 31 (clean error contract) is foundational -- Phases 32/33/34 surface their rejections/limits/probe failures through it. Phase 35 depends on SEC-01 (HMAC secret) and OBS-01 (probes confirm wiring). Phase 36 depends on Phase 33 (final tool text) and Phase 35 (real deployment path).
- Phase 36 is the only UI-touching phase (ConnectAgentHelper prerequisites + command-tool description framing) -- flagged UI hint: yes.
- v1.4 (Phases 26-30) shipped 2026-06-02; archived reference retained above.

## Deferred Items

Items deferred at v1.5 milestone start (carried from v1.4 close on 2026-06-02):

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 29 v1.4-UAT.md — 25 pending scenarios | diagnosed (manual acceptance testing not completed; automated gate green) |
| todo | 2026-05-30-system-default-common-plugin-tools.md [mcp] | pending (future idea — system-default common plugin tools) |
| out_of_scope | Headless / render-on-demand globe | deferred (command tools keep live-session behavior; serverless globe is a large effort) |
| out_of_scope | API key scopes / rotation flows | deferred (not a public-launch blocker) |
| out_of_scope | Self-hosted geocoder | deferred (global throttle sufficient for launch) |

## Operator Next Steps

- Phase 38 (E2E Smoke Test) complete -- all verification artifacts created.
- Next: Phase 39 (Engine Dual Mode) -- prepare the data engine for dual-mode operation with marketplace auth.


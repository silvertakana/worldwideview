# ADR-001 Feature Flags

Single source of truth for all feature flags introduced by
[ADR-0001](architecture/decisions/adr-0001-decentralized-plugin-auth-and-ssrf-mitigation.md)
(Decentralized Plugin Auth + SSRF Mitigation).

**Keep the per-environment table current** whenever a flag is set, changed, or
removed in Coolify. Drift between staging and production is the primary paper-cut
this doc exists to prevent.

---

## Flag Inventory

### 5 Master-Plan Flags

| Flag | Repo | Default | Meaning |
|---|---|---|---|
| `NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS` | **Local App** | `""` | **Deprecated (2026-09-26).** Cloud and demo editions now request a ticket before subscribing regardless of this list; a local instance uses it only to opt specific plugins in. Kept for one release. |
| `REQUIRE_TICKET_AUTH` | **Data Engine** | `false` | When `true`, the engine rejects any WS connection that does not present a valid ticket. Global — applies to all plugins. Replaces `WWV_SKIP_WS_AUTH=false` once JWKS is wired (step 7a). |
| `REQUIRE_TICKET_AUTH_PLUGINS` | **Data Engine** | `""` | Comma-separated plugin IDs for per-plugin enforcement before enabling the global flag. Not yet implemented (see Divergence Note below). |
| `ENFORCE_ORIGIN_ALLOWLIST` | **Data Engine** | `false` | When `true`, the engine rejects connections from Origins not in its configured allowlist. Enable after populating the allowlist from observed traffic (step 7b). |
| `PROXY_HOST_ALLOWLIST` | **Local App** | `""` (deny all) | SSRF allowlist for the camera / iframe proxy route. `""` or unset = deny all (safe default). `"*"` = permissive + logs WARN per host (observation mode). Comma-separated list = explicit allowlist. Ship `"*"` initially; tighten to an explicit list after one week of log observation (step 7c). |

### Deployed Reality: `WWV_SKIP_WS_AUTH`

> **Divergence note:** The Data Engine workstream implemented a single global bypass
> flag (`WWV_SKIP_WS_AUTH`) instead of the three granular master-plan flags
> (`REQUIRE_TICKET_AUTH`, `REQUIRE_TICKET_AUTH_PLUGINS`, `ENFORCE_ORIGIN_ALLOWLIST`).
> The master-plan flags remain the target architecture and must be implemented before
> step 7. `WWV_SKIP_WS_AUTH` is the current interim control.

| Flag | Repo | Default | Meaning |
|---|---|---|---|
| `WWV_SKIP_WS_AUTH` | **Data Engine** | `false` | When `true`, every WS connection is pre-authenticated — no JWT is checked. **Currently `true` in production and load-bearing** (JWKS not yet wired; the engine cannot verify real tokens). Must stay `true` until deploy step 4 wires JWKS. Flip to `false` as part of step 5 smoke test, replacing it with `REQUIRE_TICKET_AUTH=true`. |

---

## Per-Environment Table

Update this table whenever a flag changes in Coolify.

| Flag | Local dev | Staging | Production | Last updated |
|---|---|---|---|---|
| `NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS` | commented out (.env.example) | `""` (not set) | `""` (not set) | 2026-09-26 (deprecated) |
| `REQUIRE_TICKET_AUTH` | N/A | N/A | N/A (not yet implemented) | — |
| `REQUIRE_TICKET_AUTH_PLUGINS` | N/A | N/A | N/A (not yet implemented) | — |
| `ENFORCE_ORIGIN_ALLOWLIST` | N/A | N/A | N/A (not yet implemented) | — |
| `PROXY_HOST_ALLOWLIST` | `"*"` (.env.example) | TBD — set before step 5 | not set (= deny all) | 2026-05-21 |
| `WWV_SKIP_WS_AUTH` | `false` | TBD — set before step 4 | `true` (**load-bearing**) | 2026-05-20 |

---

## Rollout Sequence

The sequence in which flags are set during the ADR-001 deploy order:

| Deploy step | Service | Flag change | Notes |
|---|---|---|---|
| Step 1 | Local App | Set `PROXY_HOST_ALLOWLIST="*"` | Observation mode — watch WARN logs for one week |
| Step 3 | Local App | `NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS=""` confirmed empty | Dormant for a local instance; cloud and demo request tickets unconditionally |
| Step 4 | Data Engine | JWKS wired; `WWV_SKIP_WS_AUTH` remains `true` | Both paths exist, neither enforced |
| Step 5 (staging) | Local App | `NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS=test-synthetic` | Smoke test only — revert after |
| Step 5 (staging) | Data Engine | `WWV_SKIP_WS_AUTH=false` | Prove real JWT verification end-to-end |
| Step 6 | Local App | No flag change needed | Hosted editions already request tickets; the list only opts a local instance in |
| Step 6 | Data Engine | `REQUIRE_TICKET_AUTH_PLUGINS=<same-plugin>` | Mirror Local App change |
| Step 7a | Data Engine | `REQUIRE_TICKET_AUTH=true` | Global default-deny; 24 h soak |
| Step 7b | Data Engine | `ENFORCE_ORIGIN_ALLOWLIST=true` | After populating allowlist from observed connections |
| Step 7c | Local App | `PROXY_HOST_ALLOWLIST=<observed-list>` | Replace `"*"` with explicit host list |

---

## Rollback

Every step is independently revertable by flipping its single flag back. The old
no-auth data path remains wired throughout steps 1–6 and is only superseded at
step 7a. If anything breaks, removing the plugin from
`NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS` immediately restores the old path for that
plugin.

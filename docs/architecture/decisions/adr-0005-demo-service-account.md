# ADR-0005: Demo Service Account — Marketplace Identity for Anonymous Access

## Status
Proposed

## Date
2026-06-13

## Related
- **Builds on:** ADR-001 (Decentralized Plugin Auth & SSRF Mitigation) — the PKCE → API Key → JWT token exchange this ADR extends with an alternative credential source
- **Builds on:** ADR-003 (Shared Identity & Ecosystem Auth Host) — the user identity model this ADR reuses for non-human accounts
- **Supersedes:** v1.6 deferred item "Demo instance service account — needs marketplace credential for anonymous visitor authentication"

---

## Context

v1.6 (Phase 41) locked the wwv-data-engine to authenticated access. Every WebSocket connection must present a valid Ed25519 JWT signed by the marketplace. This is correct for production — it prevents unauthorized data access, enables per-user telemetry, and establishes the ADR-001B token exchange as the sole auth path.

But it leaves the demo deployment with no path for unauthenticated visitors:

- The demo instance (`demo.worldmonitor.app`) is the public face of the product. Visitors should see the globe and its data without creating an account or logging in.
- The demo instance has no PKCE-connected marketplace account. There is no `MarketplaceCredential` in its local DB to exchange for JWTs.
- The `WWV_SKIP_WS_AUTH` bypass flag exists but defeats the purpose of locking auth — enabling it on demo means the demo runs without any auth, which is a testing gap (the demo is not exercising the same code path as production).

A separate but related use case emerged during design: a self-hosted power user may want to skip the PKCE OAuth flow entirely. If they already have a marketplace API key (from generating one in their account settings), they should be able to set it directly and bypass the interactive connection flow.

---

## Decision

### ADR-005A: A Dedicated Marketplace User Is the Demo Identity

A regular marketplace `User` row serves as the demo identity. A human operator (a WorldWideView team member):

1. Signs up for a normal marketplace account (e.g., `demo@worldwideview.dev`).
2. Generates an API key from the marketplace account settings page — a standard `mk_` key created via `issueApiKey()`, stored as a SHA-256 hash in `MarketplaceApiKey`.
3. Sets the raw key as `MARKETPLACE_API_KEY` on the globe app's Coolify environment variables.

No seed script, no special admin endpoint, no hidden UI — the standard marketplace account management flow is sufficient. The operator can revoke the key and generate a new one at any time through the same UI.

The user's `tier` is set to `"demo"` (a new tier value in the `User.tier` column). This is set directly by a marketplace admin (or via the Supabase dashboard on the `marketplace_users` table). The demo tier is distinct from `free`/`pro`/`enterprise` so that JWTs carry an identifiable origin.

### ADR-005B: `MARKETPLACE_API_KEY` Env Var Is the Universal Shortcut

The globe app's `ticketClient` checks for a credential in this priority order:

1. `MARKETPLACE_API_KEY` env var — if set, use it directly (server-side only, never reaches the browser)
2. `MarketplaceCredential` DB table — existing PKCE-connected credential (decrypts with AES-256-GCM)
3. Neither — return `noCredential` (existing behavior)

This is intentionally universal — it serves three deployment modes:

| Deployment | `MARKETPLACE_API_KEY` | Behavior |
|---|---|---|
| **Demo instance** | Set to demo account's key | Anonymous visitors get data through the demo identity |
| **Self-hosted local** | Set to their own key | Skip PKCE, straight to data streaming |
| **Cloud multi-tenant** | **Not set** | Existing PKCE flow per user, unchanged |

The env var is server-side only. The raw API key never enters the browser bundle or any API response.

### ADR-005C: Demo JWTs Carry `tier: "demo"` with `scope: "plugins:read"`

The exchange endpoint (`POST /api/auth/exchange`) already reads `apiKeyRecord.user.tier` and derives scope via `scopeFor(tier)`. Adding the `"demo"` case:

```typescript
// src/lib/auth/tierScope.ts
export function scopeFor(tier: string): string {
    switch (tier) {
        case "enterprise": return "plugins:read plugins:write plugins:admin";
        case "pro":        return "plugins:read plugins:write";
        case "demo":
        case "free":
        default:           return "plugins:read";
    }
}
```

The JWT payload for a demo request:

```json
{
    "tier": "demo",
    "scope": "plugins:read",
    "iss": "https://marketplace.worldwideview.dev",
    "sub": "<demo-user-id>",
    "aud": "wwv-data-engine",
    "exp": <now + 300s>,
    "iat": <now>,
    "jti": "<uuid>"
}
```

The data engine verifies this JWT identically to any other — signature, issuer, audience, expiry. No engine-side changes. The `tier` and `scope` claims are available for future engine-level access control but are not enforced today.

### ADR-005D: No Changes to the PKCE or Cloud Path

The `MARKETPLACE_API_KEY` env var is checked before the DB lookup. If unset (cloud deployment), the existing path is identical to today:

1. `ticketClient` reads `MarketplaceCredential` from the local DB
2. Decrypts with AES-256-GCM (`ENCRYPTION_MASTER_KEY`)
3. POSTs to `/api/auth/exchange`
4. Gets a 5-minute Ed25519 JWT

No cloud user is affected. No migration is needed.

---

## Consequences

**Positive:**

- Demo visitors see the full globe without an account. The demo deployment exercises the real auth path (JWT verification at the data engine), not `WWV_SKIP_WS_AUTH`.
- Power users can bypass PKCE by setting `MARKETPLACE_API_KEY`. This is purely opt-in — no one is forced to use it.
- API key lifecycle (generation, revocation, rotation) uses the existing marketplace UI. The operator manages the demo key like any other key.
- The `"demo"` tier allows future engine-level differentiation (rate limiting, telemetry, feature flags) without guessing which traffic is demo.
- Data engine needs zero changes. The JWKS path, `verifyEngineToken()`, audience checks — all unchanged.

**Negative / accepted tradeoffs:**

- The demo operator must sign up for a marketplace account. This is a one-time setup step.
- `MARKETPLACE_API_KEY` on a cloud deployment would make every user share the same credential. The cloud deployment simply never sets this variable — enforced operationally.
- `tier: "demo"` is a new string value. Existing code that switches on tier must not accidentally handle `"demo"` as `"free"` — the explicit `case "demo":` in `scopeFor()` prevents this.
- The demo JWT's `sub` is the demo user's ID, not the anonymous visitor's. There is no individual visitor tracking — that is intentional (privacy).

---

## Migration

For existing demo deployments (none in production yet — this is pre-launch):

1. Marketplace admin creates demo user with `tier: "demo"` via Supabase dashboard on `marketplace_users` table
2. Operator logs into marketplace as demo user, generates API key from account settings
3. Operator sets `MARKETPLACE_API_KEY=<generated-key>` on the globe app's Coolify env vars
4. Redeploy globe app

No zero-downtime concern — the demo is not serving production traffic at launch.

# ADR-001 Workstream A: Marketplace Hardening (A1–A3)

## Context

The Marketplace already ships two stubbed JWT endpoints from a prior attempt:
- `GET /api/auth/jwks` — Ed25519 JWKS publication
- `POST /api/auth/exchange` — issues 5-min audience-bound EdDSA tickets

Both are functional but wrong in production-critical ways: the JWKS cache is set to 24h (mismatched against the 5-min ticket lifetime), the API-key check is a hardcoded string, and the JWT claims (`sub`, `aud`, `tier`, `scope`) are stubs.

ADR-001 (`C:\dev\worldwideview\docs\architecture\decisions\adr-0001-decentralized-plugin-auth-and-ssrf-mitigation.md`) makes this the foundation of decentralized plugin auth: each Data Engine verifies tickets offline via JWKS, with no Marketplace DB roundtrip per frame. A wrong cache TTL or missing `kid` silently breaks every consumer.

This plan delivers **A1 + A2 + A3 only** — the bounded hardening of the two existing endpoints, plus the minimum schema needed to back A3 with real DB lookups. **A4 (PKCE token endpoint + API-Key issuance UI) is deferred** to its own branch/PR per the master plan's explicit instruction: *"Treat it as its own workstream with its own sub-plan; do not bundle it into the A1–A3 deploy."*

A4 also depends on design decisions outside this scope (how a user authenticates to the Marketplace, whether there's a consent screen, how `openid-client` on the Local App expects the token response shaped) that should not be force-fit into a hardening pass.

---

## Decisions (with rationale)

### D1. Separate `User` table (vs. denormalize onto API key)
- Per ADR-001B, `sub` is "the user's unique ID" and `tier` is subscription-scoped. These are identity facts, not credential facts. A user with two devices (two API keys) shares one tier.
- Denormalizing tier onto each `MarketplaceApiKey` row creates multi-row update consistency problems on tier change.

### D2. SHA-256 for `keyHash` (vs. bcrypt per HANDOFF)
- The HANDOFF says "bcrypt of the raw key," but bcrypt is non-deterministic — `WHERE keyHash = bcrypt(input)` is impossible. The exchange endpoint would have to load every row and `bcrypt.compare` each, which is O(n) per request.
- API keys here are **32 bytes of CSPRNG output** (256 bits of entropy). Slow hashing is for low-entropy passwords; for high-entropy secrets, SHA-256 with constant-time compare is the standard (GitHub, AWS, Stripe all use deterministic hashes for API keys).
- No new dependency. Uses `node:crypto` (already a Node built-in).

### D3. Defer A4 entirely
- Master plan: A4 is its own workstream.
- A4 is gated by product decisions (Marketplace auth/login, consent UI) that don't exist yet.
- A1–A3 deliver real value independently — they make the existing JWT issuance pipeline production-correct.
- The Local App's PKCE callback is already broken (calls `/api/tickets/exchange` which doesn't exist); deferring A4 doesn't regress anything.

### D4. Scope derivation from tier (not stored)
- ADR-001B says `scope` is "specific entitlements." If stored separately from tier, the two can drift.
- Derive at JWT issuance: `free → "plugins:read"`, `pro → "plugins:read plugins:write"`, `enterprise → "plugins:read plugins:write plugins:admin"`. Single function, easy to extend.

---

## Implementation

### A1. Fix JWKS cache TTL
**File:** `src/app/api/auth/jwks/route.ts:26`

Change `max-age=86400, stale-while-revalidate=86400` → `max-age=300, stale-while-revalidate=60`.

Rationale: ticket lifetime is 5 min (300s) per ADR-001B. Cache TTL matching the ticket lifetime means a Data Engine can never have stale JWKS during a valid ticket's lifetime. `swr=60` lets engines tolerate brief Marketplace downtime — matches the ADR's "JWKS cache expires (Marketplace down) → grace period" failure mode row.

### A2. Ensure `kid` present in JWK
**File:** `src/app/api/auth/jwks/route.ts`

Currently relies on the env-var JWK having a `kid` field, which the spread `{ ...privateJwk }` carries through. But there's no defensive check — if `MARKETPLACE_JWK_PRIVATE` was generated without `kid`, the endpoint silently publishes a key with no identifier, and `get-jwks` on the Data Engine can't cache it.

Fix: after parsing, throw if `privateJwk.kid` is falsy. Return 500 with a clear error log (`MARKETPLACE_JWK_PRIVATE is missing 'kid' field — regenerate per README`).

Also: ensure `alg: "EdDSA"` is present on the published JWK so JWKS consumers can pre-validate algorithm. The spread carries it through if set; add the same defensive check.

> **Pre-mortem mitigation (TIGER, medium):** this check is fail-closed — if the *current production* `MARKETPLACE_JWK_PRIVATE` lacks `kid`, this deploy turns "JWKS works without kid" into "JWKS 500s every Data Engine fetch." **Before merging**, audit the env var in every environment (local-self-host, cloud, demo):
> ```
> node -e "const j=JSON.parse(process.env.MARKETPLACE_JWK_PRIVATE);console.log('kid:',j.kid,'alg:',j.alg)"
> ```
> If any environment prints `kid: undefined`, regenerate the keypair per the HANDOFF README *before* this code reaches that environment.

### A3. Harden the token exchange endpoint

#### A3a. Schema additions
**File:** `prisma/schema.prisma`

Add two models:

```prisma
model User {
  id        String              @id @default(cuid())
  email     String              @unique
  tier      String              @default("free")  // "free" | "pro" | "enterprise"
  createdAt DateTime            @default(now())
  apiKeys   MarketplaceApiKey[]
}

model MarketplaceApiKey {
  id         String    @id @default(cuid())
  userId     String
  keyHash    String    @unique           // SHA-256 hex of raw key, used for O(1) lookup
  deviceId   String?
  name       String?                     // user-given label, e.g. "Home Server"
  createdAt  DateTime  @default(now())
  lastUsedAt DateTime?
  revokedAt  DateTime?
  user       User      @relation(fields: [userId], references: [id])

  @@index([userId])
}
```

Run `pnpm prisma migrate dev --name add_user_and_marketplace_api_key`.

Note: `MarketplaceApiKey` model is added here even though A4 (issuance) is deferred — A3's DB lookup needs the model to exist. A4 will add the *issuance path*; A3 only consumes the table.

#### A3b. Add a `scopeFor(tier)` helper
**File (new):** `src/lib/auth/tierScope.ts`

```ts
export function scopeFor(tier: string): string {
  switch (tier) {
    case "enterprise": return "plugins:read plugins:write plugins:admin";
    case "pro":        return "plugins:read plugins:write";
    case "free":
    default:           return "plugins:read";
  }
}
```

Single source of truth; A4 will also use this.

#### A3c. Add a key-hashing helper
**File (new):** `src/lib/auth/apiKeyHash.ts`

```ts
import { createHash, timingSafeEqual } from "node:crypto";

/** Deterministic SHA-256 hex of an API key. Use for DB lookup. */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

/** Constant-time compare of two hex strings. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
```

#### A3d. Rewrite the exchange endpoint
**File:** `src/app/api/auth/exchange/route.ts`

- Parse body as `{ apiKey, audience?, plugin_id? }`.
- Reject if `apiKey` missing (400).
- Hash the apiKey via `hashApiKey()` and look up `prisma.marketplaceApiKey.findUnique({ where: { keyHash }, include: { user: true } })`.
- If not found, or `revokedAt != null` → 401.
- Update `lastUsedAt = new Date()` (fire-and-forget: `prisma.marketplaceApiKey.update(...).catch(err => console.warn("lastUsedAt update failed:", err.message))` — never await, never let it fail the request).
- JWT claims:
  - `iss`: `"https://marketplace.worldwideview.dev"` (unchanged)
  - `sub`: `apiKeyRecord.userId` (was: `"user-id-stub"`)
  - `aud`: `audience ?? "wwv-data-engine"` (default for backwards-compat per HANDOFF)
  - `tier`: `apiKeyRecord.user.tier` (was: `"pro"`)
  - `scope`: `scopeFor(apiKeyRecord.user.tier)` (was: `"plugins:read"`)
  - `exp`, `iat`, `nbf`, `jti`: unchanged
  - Header `kid`: unchanged
- Return `{ token }` as before.

#### A3e. Update tests
**File:** `src/app/api/auth/exchange/route.spec.ts`

- Mock `@/lib/prisma` with `vi.mock`. Provide a fake `prisma.marketplaceApiKey.findUnique` that returns a fixture user/key for one specific hashed key, and `null` otherwise.
- Test: invalid key → 401.
- Test: valid key → 200, JWT contains `sub` matching user id, `aud` matching request body, `tier`/`scope` matching user fixture.
- Test: revoked key (revokedAt set) → 401.
- Test: `aud` defaults to `"wwv-data-engine"` when `audience` omitted from body.
- Keep the existing claim-shape assertions.

**File:** `src/app/api/auth/jwks/route.spec.ts`
- Add: when env JWK has no `kid` → 500.
- Add: response has `Cache-Control` with `max-age=300`.

### Seed data
**File:** `prisma/seed.ts`

Add a test user + API key (only run in dev/test) so the exchange endpoint can be exercised by `curl`:

```ts
// Add to existing seed
const testUser = await prisma.user.upsert({
  where: { email: "dev@worldwideview.local" },
  update: {},
  create: { email: "dev@worldwideview.local", tier: "pro" }
});
await prisma.marketplaceApiKey.upsert({
  where: { keyHash: hashApiKey("dev-key-do-not-use-in-prod") },
  update: {},
  create: {
    userId: testUser.id,
    keyHash: hashApiKey("dev-key-do-not-use-in-prod"),
    name: "dev seed key"
  }
});
```

Raw key `dev-key-do-not-use-in-prod` is committed intentionally — it only works against a local dev DB seeded with it.

---

## Critical files

| File | Change | Task |
|---|---|---|
| `src/app/api/auth/jwks/route.ts` | Cache header + kid defensive check | A1, A2 |
| `src/app/api/auth/jwks/route.spec.ts` | New tests for kid + cache | A1, A2 |
| `prisma/schema.prisma` | Add User + MarketplaceApiKey models | A3a |
| `src/lib/auth/tierScope.ts` | **NEW** — scope derivation | A3b |
| `src/lib/auth/apiKeyHash.ts` | **NEW** — SHA-256 + constant-time compare | A3c |
| `src/app/api/auth/exchange/route.ts` | Real DB lookup, real claims | A3d |
| `src/app/api/auth/exchange/route.spec.ts` | Prisma-mocked tests | A3e |
| `prisma/seed.ts` | Dev seed user + key | (dev only) |

Existing utilities reused:
- `src/lib/prisma.ts` — singleton Prisma client.
- `jose` (already installed) — JWT signing.
- `node:crypto` — SHA-256, timing-safe compare.

---

## Verification

1. `pnpm prisma migrate dev` — migration applies cleanly to a fresh DB.
2. `pnpm test` — vitest suite green: new + updated exchange tests, jwks tests.
3. `pnpm lint && pnpm build` — no TS errors.
4. Manual end-to-end (dev):
   - `pnpm prisma db seed` — seeds dev user + key.
   - `curl http://localhost:3000/api/auth/jwks` — returns `{ keys: [{ kty:"OKP", crv:"Ed25519", x, kid, alg:"EdDSA" }] }`, no `d`, `Cache-Control: public, max-age=300, stale-while-revalidate=60`.
   - `curl -X POST http://localhost:3000/api/auth/exchange -d '{"apiKey":"dev-key-do-not-use-in-prod","audience":"wwv-aviation-engine","plugin_id":"aviation"}' -H 'Content-Type: application/json'` — returns `{ token }`.
   - Decode the JWT at jwt.io: `iss === "https://marketplace.worldwideview.dev"`, `sub` is the seeded user id, `aud === "wwv-aviation-engine"`, `tier === "pro"`, `scope === "plugins:read plugins:write"`, `exp - iat === 300`, header has `kid`.
   - Same curl with `apiKey: "valid-key-for-testing"` (the old stub) → 401.
   - Same curl with `apiKey` omitted → 400.

---

## Deployment checklist (pre-mortem mitigations)

1. **Pre-deploy env audit** — before this code reaches any environment, run:
   ```
   node -e "const j=JSON.parse(process.env.MARKETPLACE_JWK_PRIVATE);console.log('kid:',j.kid,'alg:',j.alg)"
   ```
   Both must be non-null. If `kid` is missing, regenerate the keypair (the HANDOFF README has the Node script). Do this in every environment (local-self-host, cloud, demo) before merging.

2. **Production migration** — the deploy pipeline must run `pnpm prisma migrate deploy` (not `migrate dev`) on boot before the app starts. Verify this is wired into the Coolify start command or Dockerfile CMD. The new `User` and `MarketplaceApiKey` tables must exist before any request reaches the exchange endpoint.

3. **Empty-table gap** — after A3 deploys and until A4 ships, the exchange endpoint requires a real `MarketplaceApiKey` row to issue a JWT. There are no such rows in production until A4's issuance path lands. This is acceptable because: (a) the Local App's callback is already broken today (`/api/tickets/exchange` 404s), so no real traffic is hitting this endpoint, and (b) the `dev-key-do-not-use-in-prod` seed entry gives a working dev/staging test path through the real code. Document this gap in the PR description so the next person isn't confused by a blank table.

---

## Out of scope (explicit deferrals)

- **A4 — PKCE token endpoint, OAuth authorize page, API-Key issuance UI.** Its own workstream. The `MarketplaceApiKey` model is added in A3 so A4 can plug straight in without a schema migration.
- **Key rotation overlap** (multi-key JWKS array). The JWKS endpoint already returns an array of one key; multi-key rotation is a separate concern.

---

## Risk Mitigations (Pre-Mortem)

**Pre-mortem run:** 2026-05-21 | Mode: quick | Tigers: 3 | Elephants: 1

### Tigers addressed
1. **Production migration path unclear** (medium) — Mitigation: Deployment checklist item 2 above. Plan explicitly requires `prisma migrate deploy` step.
2. **`kid` defensive check fails-closed on deploy** (medium) — Mitigation: Deployment checklist item 1 above. Mandatory pre-deploy env audit.
3. **Fire-and-forget `lastUsedAt` unhandled rejection** (low) — Mitigation: Added `.catch(warn)` to A3d spec.

### Elephant addressed
- **No user creation path until A4** — Mitigation: dev seed provides a working test path; prod gap documented in deployment checklist item 3. Acceptable because the endpoint has zero real traffic today.

### Accepted risks (none — all addressed)
- **Redis-backed `jti` counter / rate limiting.** Per ADR-001 failure-mode table, this is part of issuance hardening — not bundled here.
- **`/api/tickets/exchange` legacy path.** The Local App currently points there but it doesn't exist. Renaming the callback URL is a Local App change (workstream C1), not Marketplace.

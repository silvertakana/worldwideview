# ADR-0008: Cross-Service Linking Topology & HMAC Authentication

## Status
Accepted *(2026-06-23)*

## Date
2026-06-23

## Related
- **Builds on:** ADR-0001 (Decentralized Plugin Auth) — the same marketplace API key from PKCE is used for engine ticket exchange; cloud users skip PKCE via provisioning-time auto-link
- **Builds on:** ADR-0003 (Shared Identity) — cloud users are identified by their Supabase UUID across marketplace and globe
- **Builds on:** ADR-0007 (Globe Local Authentication with Cloud Provisioning) — the auto-link JWT runs during instance provisioning, not at login; the Globe authenticates locally for all editions after setup

---

## Context

The WorldWideView ecosystem spans four repositories. A user's identity in the marketplace must be linked to their globe instance so that plugin subscriptions, API keys, and engine tickets function. Additionally, the web hub (`worldwideview-web/`) must make server-to-server calls to the globe (`worldwideview/`) for provisioning, billing, and account management.

Two fundamentally different user populations drive a two-path design, separated by **when** linking happens, not just who does it:

| Path | User type | When linking runs | Trust basis |
|---|---|---|---|
| Auto-link (HS256 JWT) | Cloud users | **At provisioning time** (instance creation, Hub-to-Globe) | Hub's Supabase UUID is verified identity; marketplace API key is injected before user ever visits the Globe |
| PKCE OAuth | Local users | **On demand** (when user wants Marketplace plugins) | User must explicitly authorize marketplace access via browser redirect |

The key architectural insight: cloud users experience **zero manual linking**. The auto-link JWT runs server-to-server during instance creation (ADR-0007 provisioning flow), injecting the Marketplace API key into the Globe before the user sets up their account. By the time the user completes the setup page, their Marketplace credential is already stored and ready.

Local users follow the PKCE path — they must explicitly connect to the Marketplace through a browser redirect. This is the standard OAuth 2.0 Authorization Code flow with PKCE (RFC 7636), suitable for public clients that cannot keep a client secret.

The web hub's server-to-server calls to the globe require a separate mechanism — HMAC-SHA256 with per-request integrity, freshness, and replay protection.

Prior sessions saw GSD agents repeatedly propose collapsing these paths into one. This ADR exists to make those fights stop.

---

## Decision

### ADR-008A: Two-Path Marketplace Linking — Provisioning vs. On-Demand

The globe app links a user to the marketplace via one of two mutually exclusive paths, selected by when the linking happens:

#### Path 1: Auto-link at provisioning time (cloud edition)

Used when a cloud instance is created. The Hub (not the user's browser) drives this flow server-to-server during instance provisioning, as part of the ADR-0007 cloud provisioning flow. The Hub calls the Globe's provisioning API, which in turn calls the marketplace to obtain an API key:

```
Globe server                    Marketplace server
     │                                 │
     │ POST /api/connect/direct        │
     │ Authorization: Bearer <HS256 JWT>│
     │                                 │── Verify JWT with MARKETPLACE_CONNECT_SECRET
     │                                 │── Look up marketplace user by sub (Supabase UUID)
     │                                 │── Generate marketplace API key
     │◄─ { apiKey: "<key>" } ─────────│
     │                                 │
     │── Encrypt API key (AES-256-GCM) │
     │── Store in marketplaceCredential│
```

**JWT claims** (`signAutoLinkJwt` in `src/lib/cross-service/jwtSigner.ts`):
- `sub`: The user's Supabase Auth UUID
- `iat`: Issued at (Unix seconds)
- `exp`: 60 seconds after `iat`
- Algorithm: HS256, keyed with `MARKETPLACE_CONNECT_SECRET`

**Why 60 seconds:** The token only needs to survive one round-trip from globe to marketplace. A shorter expiry limits the window for replay. If the globe's clock is within 60s of the marketplace's, no clock sync issues arise.

**Idempotency:** `autoLinkToMarketplace()` checks for an existing `marketplaceCredential` row before calling the marketplace. If already linked, it returns `{ error: "already_linked" }` — no duplicate API keys are minted.

#### Path 2: PKCE OAuth at connection time (local/demo edition)

Used when a local user wants to connect to the Marketplace. The user has no Hub/Supabase identity, so they must explicitly consent to linking their globe instance to the marketplace. This is a browser-mediated OAuth 2.0 PKCE flow:

```
Browser                    Globe                    Marketplace
  │                         │                         │
  │ Click "Connect"         │                         │
  │── GET /api/marketplace/connect ──►                 │
  │                         │── Generate code_verifier │
  │                         │── SHA256 → code_challenge│
  │◄── 302 to marketplace   │                         │
  │    /oauth/authorize?    │                         │
  │    client_id=local-app  │                         │
  │    code_challenge=S256  │                         │
  │    scope=plugins:read   │                         │
  │─────────────────────────►                         │
  │                         │                         │── Validate Supabase session
  │                         │                         │   (or redirect to login)
  │                         │                         │── Show consent screen
  │                         │                         │── Issue auth code (60s TTL)
  │◄── 302 with code ─────────────────────────────────│
  │                         │                         │
  │── GET /api/marketplace/callback?code=X ──►         │
  │                         │── POST /api/oauth/token │
  │                         │   grant_type=authorization_code
  │                         │   code + code_verifier  │
  │                         │─────────────────────────►
  │                         │◄── { access_token } ────│
  │                         │── Encrypt and store     │
  │◄── success ─────────────│                         │
```

### ADR-008B: Hub-to-Globe HMAC-SHA256 Server Authentication

The web hub makes server-to-server calls to the globe for provisioning, billing, and account management (~10 endpoints). These calls are authenticated with **HMAC-SHA256** using a shared secret (`CROSS_SERVICE_SECRET`).

**Signing** (`src/lib/cross-service/sign.ts`):

```typescript
// Input: method, path, body, timestamp
// Produces three headers:
X-Service-Signature: t=1719000000,n=<uuid>,sig=<hex-hmac>
X-Service-Timestamp: 1719000000
X-Service-Nonce: <uuid>
```

The canonical string signed is: `{METHOD}\n{PATH}\n{TIMESTAMP}\n{SHA256(BODY)}`

**Verification** (`src/lib/cross-service/verify.ts`):

1. **Timestamp window:** Reject if `|now - timestamp| > 300_000` (5 minutes)
2. **Nonce replay:** Reject if nonce has been seen before (in-memory `NonceCache`, 5-min TTL)
3. **Signature:** Rebuild canonical string, compute HMAC-SHA256, compare with `crypto.timingSafeEqual`

**Why HMAC, not a static API key:**

| Property | Static API Key | HMAC-SHA256 (chosen) |
|---|---|---|
| Per-request integrity | No — key is opaque; body tampering undetected | Yes — body hash is part of the signature |
| Replay protection | No — captured key can be replayed indefinitely | Yes — nonce + 5-min timestamp window |
| Freshness guarantee | No — a key from last month still works | Yes — requests expire after 5 minutes |
| Rotation complexity | Revoke old key, distribute new key | Rotate `CROSS_SERVICE_SECRET` with a brief overlap window |

### ADR-008C: Auto-Link API Key Encryption at Rest

The marketplace API key obtained via either path is stored encrypted in the globe's `marketplaceCredential` table:

- **Algorithm:** AES-256-GCM
- **Key derivation:** PBKDF2 over `ENCRYPTION_MASTER_KEY` (the env var used by `src/lib/auth/encryption.ts`), 100,000 iterations, SHA-256, 32-byte output
- **Storage:** Separate columns for `version`, `salt`, `nonce`, and `ciphertext`
- **Versioning:** The `version` column (currently `v1`) supports future key rotation

For cloud users, the credential is keyed by `tenantId = "marketplace-{supabaseUuid}"`. For local users, `tenantId = "local"`.

### ADR-008D: Hub-to-Globe Endpoint Catalog

All hub-to-globe calls use the HMAC mechanism. The following endpoints are protected by the `crossServiceAuth` middleware:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/account` | Read account status (plan, trial, Stripe IDs) |
| GET | `/api/instance` | List user instances |
| POST | `/api/instance` | Create instance |
| PATCH | `/api/instance/{id}` | Rename instance |
| DELETE | `/api/instance/{id}` | Soft-delete instance |
| GET | `/api/instance/{id}/members` | List instance members |
| POST | `/api/instance/{id}/invite` | Create invitation |
| POST | `/api/internal/account/update` | Push billing changes from Stripe webhooks |
| GET | `/api/internal/account` | Read internal account details |
| POST | `/api/access-code` | Redeem access code |

---

## Implementation Details

### Auto-link JWT construction

The JWT is built manually in `jwtSigner.ts` (not using the `jose` library) because `jose` v6's webapi build relies on `instanceof Uint8Array`, which fails across jsdom realms in unit tests. The output is fully compatible with `jose.jwtVerify` on the marketplace side.

### HMAC middleware

The `crossServiceAuth()` middleware (`src/lib/cross-service/middleware.ts`) is a drop-in gate for globe API routes:

```typescript
const authError = await crossServiceAuth(request);
if (authError) return authError; // 401
// Route handler continues...
```

For routes that need `request.json()` after auth, the request body must be cloned before calling the middleware, since `verifyCrossServiceSignature` consumes the body to compute its hash.

### Nonce replay protection

The `NonceCache` (`src/lib/cross-service/nonceCache.ts`) is an in-memory `Map<string, number>` with an expiry-based cleanup interval (every 60 seconds). It is scoped to a single process — if the globe runs multiple instances behind a load balancer, a nonce could be replayed against a different instance. At current scale (single-instance Coolify deployment), this is acceptable. A Redis-backed nonce store is the follow-up if horizontal scaling is introduced.

---

## Consequences

**Positive:**
- Cloud users get completely invisible marketplace linking — the auto-link JWT runs server-to-server during instance provisioning before the user ever visits the Globe. By the time they complete the setup page, their Marketplace API key is already stored.
- Local users get explicit consent via standard OAuth PKCE — no trust assumptions required. They initiate the connection when they want Marketplace plugins.
- Hub-to-globe calls carry per-request integrity proofs — a leaked `CROSS_SERVICE_SECRET` from past logs does not enable replay of captured requests
- Each auth mechanism is scoped to exactly its caller-provider pair — no mechanism is overloaded

**Negative / accepted tradeoffs:**
- Two linking paths means two code paths to maintain and test. The provisioning flag (whether the instance was cloud-provisioned) gates which path is active, so only one path executes per deployment.
- The HMAC nonce cache is process-local — a horizontally scaled globe would need a shared nonce store (Redis). This is deferred.
- `CROSS_SERVICE_SECRET` and `MARKETPLACE_CONNECT_SECRET` must be identical between hub and globe, and globe and marketplace, respectively. No automated rotation mechanism exists. Manual rotation requires a brief overlap window during which both old and new secrets are accepted (not yet implemented).
- PKCE requires the browser to complete a redirect chain. If the user closes the browser during the flow, the code verifier is lost and the flow must restart.
- The auto-link JWT runs during provisioning — if the marketplace is unreachable at instance creation time, the API key injection fails. The provisioning flow must handle this gracefully (retry or deferred linking).

---

## Rejected Alternatives

### "Single shared API key for hub-to-globe instead of HMAC"
**Rejected.** A static API key provides no per-request integrity (body tampering is undetected), no replay protection (a captured key works forever), and no freshness guarantee (a key from months ago still authenticates). HMAC-SHA256 addresses all three. The additional complexity is an HMAC computation per request — negligible.

### "Remove PKCE, use the auto-link flow for all users"
**Rejected.** Local users do not have a hub/Supabase identity that can be passed as a JWT `sub` claim. There is no UUID to embed. Forcing local users through an auto-link would require either (a) creating a Supabase account for every local user (breaking the open-source contract) or (b) minting synthetic UUIDs not backed by any identity provider (creating an impersonation vector).

### "Remove auto-link, force all users through PKCE"
**Rejected.** Cloud users are already authenticated at the hub with Supabase. Forcing them through a browser redirect to the marketplace consent screen, when they have already consented during cloud plan signup, adds unnecessary friction. The auto-link path is a UX optimization for the population that already has verified identity.

### "Collapse auto-link and PKCE into one unified flow"
**Rejected.** The two paths exist because the two user populations have fundamentally different trust starting points. Cloud users arrive with a verified Supabase UUID — the globe can prove who they are to the marketplace without user interaction. Local users arrive anonymous to the marketplace — they must establish a relationship through explicit OAuth consent. A unified flow would either add unnecessary interaction for cloud users or remove necessary consent for local users.

### "Use JWT for hub-to-globe instead of HMAC"
**Rejected.** JWT requires an issuer (who signs?) and a key distribution mechanism (JWKS endpoint or shared secret). A JWT with a shared secret is functionally equivalent to HMAC but with added complexity (header parsing, claim validation, algorithm negotiation). HMAC-SHA256 is simpler: sign a canonical string, attach the signature, verify on the other side. No JWT library dependency needed for this specific path.

### "Use mTLS for hub-to-globe instead of HMAC"
**Rejected.** Mutual TLS provides transport-level authentication but requires certificate management infrastructure (CA, issuance, rotation, revocation). At current scale (two services on a private network), the operational burden of mTLS outweighs its benefits. HMAC over HTTPS provides application-level integrity that survives TLS termination at reverse proxies. mTLS can be reconsidered if the ecosystem grows to 10+ services.

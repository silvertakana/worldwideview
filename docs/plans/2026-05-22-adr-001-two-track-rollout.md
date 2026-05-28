# ADR-001 Production Auth Rollout — Two-Track Strategy

## Context

PR #9 (`wwv-data-engine`) merged + deployed. Auth is bypassed (`WWV_SKIP_WS_AUTH=true`).
`WWV_SKIP_WS_AUTH` lives on the **engine** — flipping it affects every app connecting
to that engine (demo, local, future cloud). The demo has anonymous visitors with no
user session. It needs a **service credential** (machine-to-machine API key) so
`/api/auth/ticket` can issue JWTs on behalf of visitors with no session.

ADR-003 (Supabase identity) is not yet implemented and blocks the full PKCE user
flow. It must not block the demo deployment.

**Strategy:**
- **Track A (demo, immediate):** Seed a service credential into production DBs → flip
  auth on → zero user-facing change. No PKCE needed.
- **Track B (local/self-hosted, medium-term):** Implement the PKCE OAuth server on
  the marketplace using admin-password auth (no Supabase). When ADR-003 lands,
  replace the password check with Supabase session check — same OAuth interface,
  no client changes.

---

## Track A — Demo Service Credential (Production)

### Why this works
**`src/core/edition.ts` line 70:** `export const isAuthEnabled: boolean = !isDemo;`

`isAuthEnabled = false` in demo edition → `/api/auth/ticket` skips the session
gate entirely and calls `getTicket()` directly. The admin's "special login page"
uses `WWV_DEMO_ADMIN_SECRET` — a completely separate mechanism unrelated to the
ticket flow. Every anonymous visitor can call `/api/auth/ticket` and get a JWT,
provided `MarketplaceCredential { tenantId: "local" }` exists in the demo DB.

Also confirmed: `ticketAuthEnabledForPlugin()` parses `NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS`
as CSV. The current `"\"\""` bug in Coolify makes it parse to no valid IDs → all
plugins skip ticket auth → they connect unauthenticated → `WWV_SKIP_WS_AUTH=true`
lets them in. Fixing the env var + adding the credential + flipping auth is the
complete transition.

### Prerequisites (Coolify → `worldwideview-demo` → Environment)
```
ENCRYPTION_MASTER_KEY=<generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
MARKETPLACE_URL=https://marketplace.worldwideview.dev
```
Set these before running the seed script. The master key is used to encrypt the
credential at seed time and decrypt it at runtime.

### Step A1 — Write seed script

**File:** `local-scripts/seed-demo-credential.mjs`

One idempotent run does:
1. Connects to marketplace SQLite on the server (SSH + direct file access or
   Prisma with `DATABASE_URL=file:<path>`)
   - Upserts `User { email: "demo@worldwideview.dev", tier: "pro" }`
   - Generates raw API key: `crypto.randomBytes(32).toString('hex')`
   - SHA256-hashes it → upserts `MarketplaceApiKey { userId, keyHash, revokedAt: null }`

2. Connects to demo PostgreSQL
   - AES-256-GCM encrypts the raw API key using `ENCRYPTION_MASTER_KEY`
     (matching the format in `src/lib/auth/encryption.ts`:
     `pbkdf2Sync(key, salt, 100000, 32, 'sha256')` → cipher → `base64(ct).base64(tag)`)
   - Upserts `marketplace_credentials { tenantId: "local", version:"v1", salt, nonce, ciphertext }`

3. Prints `[seed] ✅ Demo service credential installed`

### Step A2 — Fix env var + rebuild demo
Coolify → `worldwideview-demo` → Environment:
- `NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS` → `aviation,maritime` (remove literal quotes)
- Trigger **rebuild** (build-time env var — restart alone doesn't pick it up)

### Step A3 — Verify ticket route
```bash
curl https://<demo-fqdn>/api/auth/ticket?pluginId=aviation
# expect: { "token": "eyJ..." }
```
- 500 → `ENCRYPTION_MASTER_KEY` mismatch or credential not seeded
- 200 with no `token` field → `ticketClient` returned wrong shape
- 401 → `isAuthEnabled` is true (shouldn't happen in demo edition — check `NEXT_PUBLIC_WWV_EDITION=demo`)

### Step A4 — Flip auth on engine
Coolify → `wwv-engine-stack` → Environment → `WWV_SKIP_WS_AUTH=false` → Deploy.

### Step A5 — Smoke test
```bash
node local-scripts/local-smoke-test.mjs  # pointed at production URLs
# Step 1: JWKS ✅  Step 2: Exchange ✅  Step 3: WS welcome ✅
```

---

## Track B — PKCE OAuth Server on Marketplace (Local/Self-Hosted)

Implements the missing `GET /oauth/authorize` (consent page) and
`POST /api/oauth/token` (code exchange) on the marketplace. Uses admin-password
auth for now — Supabase replaces the password check when ADR-003 lands. Same
OAuth interface; no client-side changes needed during that migration.

### Files to create/modify in `c:/dev/worldwideview-marketplace/`

**`prisma/schema.prisma`** — add:
```prisma
model OAuthCode {
  id            String    @id @default(cuid())
  code          String    @unique
  userId        String
  user          User      @relation(fields: [userId], references: [id])
  codeChallenge String
  redirectUri   String
  clientId      String
  scope         String
  state         String
  expiresAt     DateTime
  usedAt        DateTime?

  @@index([code])
}
```
Add `oauthCodes OAuthCode[]` to `User`. Run `npx prisma db push` (SQLite, local).

**`src/app/oauth/authorize/page.tsx`** — consent UI:
- Reads URL params: `client_id`, `code_challenge`, `state`, `redirect_uri`, `scope`
- Renders form: "Local App is requesting access to your data. Enter your admin password."
- Stores params in hidden fields, POSTs to `/api/oauth/authorize`

**`src/app/api/oauth/authorize/route.ts`** (POST):
- Validates `password === process.env.ADMIN_PASSWORD`
- Finds or creates `User { email: "local@marketplace", tier: "pro" }`
- Creates `OAuthCode { code: randomBytes(32).hex, expiresAt: now+10min, ... }`
- Redirects to `redirectUri?code=<code>&state=<state>`
- **ADR-003 migration point:** swap password check for `supabase.auth.getUser()` session check

**`src/app/api/oauth/token/route.ts`** (POST, `application/x-www-form-urlencoded`):
- Parses `{ grant_type, code, code_verifier, client_id, redirect_uri }`
- Finds `OAuthCode`; verifies not expired, not used, clientId + redirectUri match
- PKCE: `createHash('sha256').update(code_verifier).digest('base64url') === codeChallenge`
- Marks `usedAt = now` (replay protection)
- Generates raw API key: `randomBytes(32).hex`
- SHA256-hash → creates `MarketplaceApiKey { userId, keyHash }`
- Returns `{ access_token: rawApiKey, token_type: "bearer" }`

**Note:** `connect/route.ts` in local app redirects to `/oauth/authorize` (no `/api/` prefix)
— the consent page is at that path. The POST handler is at `/api/oauth/authorize`.

### Local app env (`.env.local`):
```
NEXT_PUBLIC_WWV_MARKETPLACE_URL=http://localhost:3001
ENCRYPTION_MASTER_KEY=<any-32+-char-string>
```

### Verification (Track B)
1. Start all 3 services locally
2. Browser: `http://localhost:3000/api/marketplace/connect`
   → redirects to `http://localhost:3001/oauth/authorize?...`
   → enter admin password → redirects back to local app
3. `GET http://localhost:3000/api/auth/ticket?pluginId=aviation` → `{ token: "eyJ..." }`
4. Check WebSocket in devtools → `{ type: "welcome" }`

---

## ADR-003 Migration Path (future, no client changes needed)
When Supabase Auth is wired into the marketplace:
- `/api/oauth/authorize` replaces `password === ADMIN_PASSWORD` with `supabase.auth.getUser()`
- If no session → redirect to `worldwideview.dev/login?redirect_to=marketplace.../oauth/authorize?...`
- Everything else stays identical — same code format, same token endpoint, same local app callback

---

## Order of Execution
1. **Track A first** (demo service credential + auth flip) — unblocks production
2. **Track B in parallel or after** (PKCE for local instances) — enables proper self-hosted UX
3. **ADR-003 later** — migrates marketplace auth internals without touching clients

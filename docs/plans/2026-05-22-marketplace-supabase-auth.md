# Plan: Marketplace Authentication (Supabase Auth — Shared Identity)

## Context

The Marketplace (`marketplace.worldwideview.dev`, repo: `c:/dev/worldwideview-marketplace`) and the Cloud App (`app.worldwideview.dev`) share one identity ecosystem. A user who creates an account on the Marketplace can use that same account to access the Cloud App, and vice versa — no second signup required. This is called **Federated Identity / Single Sign-On (SSO)** and is the same model used by GitHub (one account → GitHub + GitHub Marketplace + GitHub Actions), Atlassian (one account → Jira + Confluence + Marketplace), and Stripe (one account → Dashboard + Stripe Apps).

The Marketplace has no database yet, so Supabase is the right choice: one Supabase project serves as the **shared identity store** for all WorldWideView products. Both the Marketplace and the Cloud App point at the same Supabase project URL — the same `auth.users` table — so a user is one entity across the entire ecosystem.

The Marketplace also acts as the **OAuth 2.0 Authorization Server** in the ADR-001 PKCE flow — when a Local App user clicks "Connect to Marketplace," they are redirected here to authorize, and the Marketplace issues a short-lived code that the Local App exchanges for an API Key.

> **⚠️ Rule conflict to resolve:** `.agents/rules/cloud-auth-architecture.md` currently says `app.worldwideview.dev` owns all login UI and the Marketplace redirects there. This plan reverses that — **Marketplace is the identity source**, and the Cloud App will defer to it. That rule file must be updated after this plan is approved.

---

## Decision: Shared Supabase Auth + Supabase Postgres

**Why:**
- **One user table for the whole ecosystem** — `auth.users` is shared. A user created on Marketplace is immediately valid on Cloud App. No sync job, no duplication.
- No database to spin up — Supabase project gives you Postgres + Auth in one dashboard click
- Google OAuth, GitHub OAuth, magic link, email+password all configured in the Supabase dashboard (no code for provider setup)
- Prisma connects to Supabase Postgres via standard `DATABASE_URL` — app data (plugins, installs, etc.) lives alongside auth tables
- Well-trodden Stripe + Supabase integration path via the [Vercel subscription payments starter](https://github.com/vercel/nextjs-subscription-payments)
- Free tier covers early-stage Marketplace comfortably
- `@supabase/ssr` package has first-class Next.js App Router support (server components, middleware, server actions)

**Accepted tradeoff:** Supabase vendor dependency — if pricing changes at scale, migration to self-hosted Postgres + Better Auth is straightforward because Prisma abstracts the DB layer.

**Known gotcha — cookie domain across subdomains:** Supabase session cookies are scoped per-app by default. A session from `marketplace.worldwideview.dev` does not automatically carry over to `app.worldwideview.dev`. Fix: after login on either app, set a shared JWT cookie on the parent domain `worldwideview.dev` (via custom middleware) that both subdomains can read and validate against the shared Supabase public key. This is the only custom plumbing required — both apps still use the same Supabase JWT secret for validation.

**Upgrade path:** If the Marketplace later needs to support third-party app integrations (external developers building plugins), flip to the **Marketplace-as-OAuth-Provider** model — the user table stays the same, you add the PKCE authorization layer on top. No user migration needed.

---

## What to Build

### Step 1 — Create Supabase Project

1. Go to supabase.com → New project → name it `wwv-marketplace`
2. In **Authentication → Providers**, enable:
   - **Email** (email+password + magic link)
   - **Google** (add Client ID + Secret from Google Cloud Console)
   - **GitHub** (add Client ID + Secret from GitHub OAuth App)
3. Save the project URL and anon key (go into `.env.local`)

### Step 2 — Install Packages

```bash
pnpm add @supabase/supabase-js @supabase/ssr
pnpm add -D prisma @prisma/client
```

### Step 3 — Configure Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # server-only, never expose to client

# Prisma (Supabase Postgres — use the "Transaction" pooler URL)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

# Ed25519 key for plugin ticket signing (ADR-001B)
MARKETPLACE_ED25519_PRIVATE_KEY=   # base64 PEM
MARKETPLACE_ED25519_KID=           # key ID (for JWKS rotation)

# OAuth server (PKCE for Local App)
OAUTH_CLIENT_REDIRECT_URI_ALLOWLIST=http://localhost:3000/api/marketplace/callback,https://app.worldwideview.dev/api/marketplace/callback
```

### Step 4 — Supabase Client Helpers

**`src/lib/supabase/server.ts`** — server-side client (server components, server actions, API routes):
```ts
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  )
}
```

**`src/lib/supabase/client.ts`** — browser client:
```ts
import { createBrowserClient } from "@supabase/ssr"
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### Step 5 — Auth Middleware (session refresh)

**`src/middleware.ts`** — refreshes Supabase session on every request:
```ts
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) } }
  )
  await supabase.auth.getUser() // refreshes session token
  return response
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] }
```

### Step 6 — Auth Callback Route

**`src/app/auth/callback/route.ts`** — Supabase redirects here after social login to exchange the code for a session:
```ts
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"
  if (code) {
    const supabase = createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(`${origin}${next}`)
}
```

### Step 7 — Login UI

**`src/app/login/page.tsx`** — single page with four auth methods:
- Email + password (`supabase.auth.signInWithPassword()`)
- Google (`supabase.auth.signInWithOAuth({ provider: "google" })`)
- GitHub (`supabase.auth.signInWithOAuth({ provider: "github" })`)
- Magic link (`supabase.auth.signInWithOtp({ email })`)

All OAuth redirects must include `redirectTo: "${origin}/auth/callback"`.

### Step 8 — Prisma Schema for App Data

Supabase manages the `auth.users` table internally. For app-specific data, add to `prisma/schema.prisma`:

```prisma
// References Supabase auth.users UUID — do NOT store password/session data here
model MarketplaceUser {
  id        String   @id // matches auth.users.id (UUID)
  email     String   @unique
  plan      String   @default("free")   // "free" | "pro" | "team"
  stripeCustomerId String?
  createdAt DateTime @default(now())
  plugins   InstalledPlugin[]
}

model InstalledPlugin {
  id        String   @id @default(cuid())
  userId    String
  pluginId  String
  installedAt DateTime @default(now())
  user      MarketplaceUser @relation(fields: [userId], references: [id])
  @@unique([userId, pluginId])
}
```

Run `prisma migrate dev` pointing at the Supabase Postgres URL.

### Step 9 — OAuth 2.0 PKCE Authorization Server (for Local App)

This is the custom layer that lets the Local App "connect" to the Marketplace. Supabase handles user identity; these routes handle the code exchange.

**`src/app/api/oauth/authorize/route.ts`**
- Validates: `client_id`, `redirect_uri` (must match allowlist), `code_challenge`, `code_challenge_method=S256`, `state`
- Calls `supabase.auth.getUser()` — if not logged in, redirects to `/login?redirect_to=...`
- Shows a consent screen ("Allow WorldWideView Local App to access your account?")
- On approval: stores `{ code, code_challenge, user_id, expires: now+60s }` in Supabase DB, redirects to `redirect_uri?code=...&state=...`

**`src/app/api/oauth/token/route.ts`**
- Validates `code` + `code_verifier` (SHA-256(`code_verifier`) must equal stored `code_challenge`)
- Issues a long-lived API Key (random 32-byte token), stores hashed in DB
- Returns `{ access_token, token_type: "Bearer" }` — this is what the Local App encrypts and stores

**`src/app/api/auth/exchange/route.ts`** *(ADR-001B)*
- Accepts API Key + `audience` (plugin ID)
- Verifies API Key against DB, checks subscription tier
- Issues a 5-minute EdDSA JWT signed with the Marketplace Ed25519 key, scoped to the requested plugin
- Data Engines verify this JWT via the public JWKS endpoint

**`src/app/.well-known/jwks.json/route.ts`**
- Returns the Marketplace's Ed25519 public key in JWKS format
- Data Engines call this on startup and cache it (ADR-001A)

---

## Critical Files (Marketplace repo: `c:/dev/worldwideview-marketplace`)

| File | Purpose |
|---|---|
| `src/lib/supabase/server.ts` | Server-side Supabase client |
| `src/lib/supabase/client.ts` | Browser-side Supabase client |
| `src/middleware.ts` | Session refresh on every request |
| `src/app/auth/callback/route.ts` | OAuth callback from Supabase (social login) |
| `src/app/login/page.tsx` | Login UI (all 4 methods) |
| `prisma/schema.prisma` | App data schema (MarketplaceUser, InstalledPlugin) |
| `src/app/api/oauth/authorize/route.ts` | PKCE auth endpoint (Local App connects here) |
| `src/app/api/oauth/token/route.ts` | PKCE token exchange |
| `src/app/api/auth/exchange/route.ts` | API Key → 5-min EdDSA JWT (ADR-001B) |
| `src/app/.well-known/jwks.json/route.ts` | Public JWKS for Data Engine JWT verification |
| `.env.local` | Supabase + Prisma + Ed25519 keys |

---

## Stripe Integration Path (Future)

When ready to add payments:
1. Install `stripe` + `@stripe/stripe-js`
2. On user signup (Supabase `auth.onAuthStateChange`), create a Stripe customer and save `stripeCustomerId` to `MarketplaceUser`
3. Use Stripe Billing for subscriptions — webhook updates `MarketplaceUser.plan`
4. The `exchange` endpoint reads `plan` to enforce tier in the issued JWT (`tier` claim per ADR-001B)

Reference: [Vercel Next.js + Supabase + Stripe starter](https://github.com/vercel/nextjs-subscription-payments)

---

---

## Risk Mitigations (Pre-Mortem — 2026-05-22)

### Tigers Addressed

**[HIGH] RLS not configured on app tables**
- All tables that contain user-scoped data (`MarketplaceUser`, `InstalledPlugin`) MUST have Row Level Security enabled in Supabase before going live.
- Add to `prisma/migrations/` as a raw SQL migration (Prisma doesn't support RLS natively):
  ```sql
  ALTER TABLE "MarketplaceUser" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can only access own row" ON "MarketplaceUser"
    USING (id = auth.uid());

  ALTER TABLE "InstalledPlugin" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can only access own plugins" ON "InstalledPlugin"
    USING ("userId" = auth.uid());
  ```
- Server-side routes that need full access use `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS by design — keep it server-only, never expose to client).

**[HIGH] Authorization code not invalidated after use**
- In `/api/oauth/token/route.ts`, wrap the validation and API Key issuance in a transaction:
  1. `SELECT` the code row (validate `code_challenge`)
  2. `DELETE` the code row
  3. Issue the API Key
  4. Commit
- If the DELETE fails or the row is already gone, return `400 invalid_grant`. This prevents replay attacks within the 60s window.

### Medium Risks Addressed

**[MEDIUM] Supabase email rate limit breaks magic link**
- Configure a custom SMTP provider in Supabase Dashboard → Project Settings → Auth → SMTP Settings before enabling magic link in production.
- Recommended: Resend (free tier = 3,000 emails/month, 100/day). Add `RESEND_API_KEY` to env and configure in Supabase dashboard — no code change needed.

**[MEDIUM] MarketplaceUser orphan on auth.users delete**
- Add a Postgres trigger via raw SQL migration:
  ```sql
  CREATE OR REPLACE FUNCTION handle_deleted_user()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
  BEGIN
    DELETE FROM "MarketplaceUser" WHERE id = OLD.id;
    RETURN OLD;
  END;
  $$;

  CREATE TRIGGER on_auth_user_deleted
    AFTER DELETE ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE handle_deleted_user();
  ```

**[MEDIUM] Ed25519 key rotation — no zero-downtime strategy**
- Do not store the Ed25519 key only in an env var. Add a `SigningKey` table to Prisma schema:
  ```prisma
  model SigningKey {
    kid        String   @id
    publicKey  String   // PEM, served in JWKS
    privateKey String   // encrypted at rest
    status     String   // "active" | "retiring" | "revoked"
    expiresAt  DateTime?
    createdAt  DateTime @default(now())
  }
  ```
- The JWKS endpoint serves ALL `status != "revoked"` keys. During rotation: add a new key (`active`), flip the old key to `retiring`, wait 10 minutes for Data Engine caches to expire, then flip old key to `revoked`.

### Accepted Risks
- None — all identified risks have been mitigated in plan.

---

## Verification

1. **Social login:** Click "Continue with Google" → Google OAuth flow → redirects to `/auth/callback` → lands on dashboard logged in
2. **Magic link:** Enter email → receive email → click link → logged in
3. **PKCE flow (end-to-end):** From Local App, click "Connect to Marketplace" → redirected to `/api/oauth/authorize` → must log in first if not logged in → consent screen → approve → back to Local App with `code` → Local App calls `/api/oauth/token` → receives API Key → stored encrypted in Local App DB
4. **Plugin ticket:** Local App POSTs API Key + `audience` to `/api/auth/exchange` → receives 5-min JWT → browser sends as WebSocket first message to Data Engine → engine verifies via JWKS → stream opens
5. **Unauthenticated protection:** Hit `/api/oauth/authorize` without a session → must redirect to login, not error

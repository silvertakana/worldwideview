# ADR-0003: Shared Identity & Ecosystem Authentication Host

## Status
Accepted *(Phase 2A-D implementation complete 2026-05-25)*

### Implementation notes (Phase 2 closeout)
- `worldwideview/src/lib/supabase/cookieOptions.ts`, `server.ts`, `client.ts` added — mirrors marketplace recipe
- `worldwideview/src/app/login/actions.ts` migrated from `@supabase/supabase-js` to `@supabase/ssr` `createServerClient` so login actually persists a Supabase session cookie
- `getSafeRedirect` updated to allow trusted subdomains via `NEXT_PUBLIC_WWV_COOKIE_DOMAIN`
- `/auth/callback` route added to handle Supabase PKCE email verification flow
- `/signup` page and server action added at the auth host
- `worldwideview-marketplace/src/app/api/install/start/route.ts` — new server-side auth gate for plugin installs
- `InstallButton.handleInstall` retargeted to `/api/install/start` (was building WWV URL client-side with no auth check)
- `requireSupabaseUser` redirect param renamed `?next=` to `?callbackUrl=` to match WWV login page
- `install-redirect/route.ts` updated to use Supabase auth for cloud edition, NextAuth for local/demo
- `httpOnly: true` added to `buildCookieOptions()` in both repos
- NextAuth (Credentials provider) retained for local and demo editions

## Date
2026-05-22

## Related
- **Builds on:** ADR-001 (Decentralized Plugin Auth & SSRF Mitigation) — specifically the PKCE flow that lets the Local App acquire tokens from the Marketplace
- **Cloud App host corrected by:** ADR-0010 (Ecosystem Domain Map & Per-Tenant MCP Endpoints) — `app.worldwideview.dev` does not resolve and is not live; cloud instances live at `<name>.cloud-wwv.dev`. The auth-host decision in this ADR is unaffected.
- **Supersedes:** `.agents/rules/cloud-auth-architecture.md` (which incorrectly states that `app.worldwideview.dev` owns all login UI — this ADR reverses that)

---

## Context

WorldWideView is growing into a multi-product ecosystem:

| Product | URL | Purpose |
|---|---|---|
| Landing / Auth | `worldwideview.dev` | Marketing, login, signup, cloud plan registration |
| Marketplace | `marketplace.worldwideview.dev` | Browse, install, and manage plugins |
| Cloud App | `app.worldwideview.dev` (or `[tenant].app.worldwideview.dev`) | Hosted geospatial intelligence instance |
| Local App | Self-hosted | User's own instance, authenticated locally |

Four interrelated problems required a unified decision:

1. **No Marketplace identity system exists.** Users have nowhere to create an account, log in, or manage subscriptions.
2. **Fragmented account experience.** Without a plan, a user would need separate accounts for the Marketplace and the Cloud App — unacceptable for a single-vendor ecosystem.
3. **Cookie domain fragmentation.** If each product hosts its own login page, sessions cannot be shared across subdomains. A user logged into the Marketplace would need to log in again at the Cloud App.
4. **The `worldwideview-web` repo is a static export** (`output: "export"`). It has a `/login` page backed by client-side Supabase but cannot support server-side sessions, API routes, or cross-subdomain cookie management.

---

## Decisions

### ADR-003A: Federated Identity — One Account Across All Products

All WorldWideView products share a **single identity**. A user who creates an account anywhere in the ecosystem (Marketplace, Cloud App, or the landing site) has that same identity available everywhere else.

This is the standard industry pattern for multi-product SaaS — used by GitHub (one account → GitHub, Marketplace, Actions, Packages), Atlassian (one account → Jira, Confluence, Marketplace), and Stripe (one account → Dashboard, Atlas, Stripe Apps).

The shared identity store is a **single Supabase project**. All products point to the same `NEXT_PUBLIC_SUPABASE_URL` and read from the same `auth.users` table. No synchronisation jobs, no duplicate user records.

### ADR-003B: Supabase Auth as the Identity Provider

**Supabase Auth** is the identity layer for the entire ecosystem. It was chosen over:

- **Better Auth** — excellent self-hosted option, but requires a Postgres database to be provisioned separately. Since the Marketplace and `worldwideview-web` have no existing database, Supabase provides auth + Postgres in a single managed service with zero extra infrastructure.
- **NextAuth v5** — already present in the Local App for local access control, but it is not a full identity platform. Missing 2FA, RBAC, and a proper OAuth server model. Not suitable as an ecosystem-wide IdP.
- **Clerk** — fastest setup and best Stripe integration, but ~$25–50/month at low user counts, per-MAU pricing at scale, and user data is stored on Clerk's servers. Vendor lock-in is unacceptable for a product that holds plugin and subscription data.

Supabase Auth provides:
- Email + password, Google OAuth, GitHub OAuth, and magic link — all configured in the Supabase dashboard with no provider code
- `@supabase/ssr` package with first-class Next.js App Router support (server components, middleware, server actions)
- Cookie-based sessions that can be scoped to the parent domain
- Free tier is sufficient for early-stage Marketplace; Pro plan ($25/month) unlocks unlimited MAU

### ADR-003C: `worldwideview.dev` (worldwideview-web repo) is the Ecosystem Auth Host

The login and account registration UI lives at **`worldwideview.dev`** — the apex domain, served by the `worldwideview-web` repository. Three alternatives were considered:

**Option A — Each app has its own login page**
Rejected. Each product renders its own login form against the shared Supabase project. Browser `localStorage` (used by client-side Supabase) is domain-scoped and cannot be shared across subdomains. This means a user logged in at `marketplace.worldwideview.dev` would not be recognised at `app.worldwideview.dev`. Solving this in each app separately creates duplicated middleware and fragile cookie coordination.

**Option B — Marketplace owns the login page**
Rejected. The Cloud App would be permanently subordinate to the Marketplace for authentication. If the Marketplace is down, Cloud App users cannot log in. Also creates a confusing UX: users navigate to `app.worldwideview.dev` and are immediately bounced to `marketplace.worldwideview.dev` just to authenticate.

**Option C — Dedicated `accounts.worldwideview.dev` subdomain**
Seriously considered. A neutral auth subdomain is the cleanest long-term architecture. Rejected for now because it requires a third Next.js deployment and a third Coolify application. The same result is achieved by hosting auth on the apex domain itself (`worldwideview.dev`), which is already managed by `worldwideview-web` and is the identity host by virtue of owning the root domain.

**Chosen: Apex domain as auth host.** The `worldwideview-web` repo becomes the auth surface for the whole ecosystem:

| Path | Type | Purpose |
|---|---|---|
| `/` | Static | Landing page (marketing) |
| `/about`, `/docs`, `/plugins` | Static | Marketing content |
| `/login` | Dynamic (SSR) | Shared login for all products |
| `/signup` | Dynamic (SSR) | New account creation |
| `/cloud` | Dynamic (SSR) | Cloud plan registration and subscription |
| `/accounts/*` | Dynamic (SSR) | Account management, billing, API keys |
| `/api/auth/callback` | Dynamic (SSR) | OAuth redirect handler (Google, GitHub) |

**Why the apex domain is correct:** A session cookie set on `worldwideview.dev` is automatically inherited by all subdomains (`marketplace.worldwideview.dev`, `app.worldwideview.dev`, and any future product). This is the same mechanism used by Stripe — `stripe.com/login` sets the session that `dashboard.stripe.com` reads.

### ADR-003D: Cross-Subdomain Session Sharing via Parent Domain Cookie

Supabase Auth session cookies are explicitly scoped to the parent domain so that all products share the same session without additional coordination:

```typescript
// Applied in worldwideview-web middleware and all Supabase server clients
cookieOptions: {
  domain: '.worldwideview.dev',  // leading dot = all subdomains inherit
  path: '/',
  sameSite: 'lax',
  secure: true,                  // HTTPS required — see local dev below
}
```

Each product (Marketplace, Cloud App) reads this cookie to get the authenticated user, then calls `supabase.auth.getUser()` server-side to validate the session. No cross-app API calls for authentication.

**Logout** must clear the cookie on the parent domain, not the subdomain, or the session will persist across products.

### ADR-003E: `worldwideview-web` Converts from Static Export to Mixed Static/SSR

The current `worldwideview-web` uses `output: "export"` in `next.config.ts`, forcing every page to be a static HTML file served by Nginx. This is removed.

Without `output: "export"`, Next.js App Router applies per-route rendering:
- Pages that do not call `cookies()`, `headers()`, or other dynamic functions are **statically generated at build time** — marketing pages remain fast and CDN-cached with no change required.
- Pages that call `cookies()` (all auth pages using `@supabase/ssr`) are **server-rendered on request**.

The Docker deployment changes from an Nginx static image to a Node.js runtime image. The Coolify application is updated in-place — no new Coolify application is needed.

### ADR-003F: `wwv.local` Local Development Environment

Because the parent-domain cookie requires `secure: true` (HTTPS only), local development using `localhost` will not replicate production session-sharing behaviour. A local HTTPS domain is required.

The project adopts `wwv.local` as the local development TLD with a self-signed certificate:

| Local URL | Maps to | Purpose |
|---|---|---|
| `wwv.local` | worldwideview-web on port 3001 | Landing + auth |
| `marketplace.wwv.local` | worldwideview-marketplace on port 3002 | Marketplace |
| `app.wwv.local` | worldwideview main app on port 3000 | Local App / Cloud App |

This setup is a deliberate investment: it ensures that cross-subdomain auth, redirect flows, and cookie behaviour can be tested locally before production deployment. The setup cost is a one-time `mkcert` install and hosts file edit per developer machine.

Setup (documented in each repo's README):
```bash
# Install mkcert (once per machine)
# macOS: brew install mkcert && mkcert -install
# Windows: choco install mkcert && mkcert -install

mkcert "*.wwv.local" wwv.local
# Add to hosts: 127.0.0.1 wwv.local marketplace.wwv.local app.wwv.local
```

---

## Security Constraints (from Pre-Mortem Review)

The following risks were identified and mitigated before implementation:

| Risk | Mitigation |
|---|---|
| Supabase anon key can read all rows if RLS is disabled | Row Level Security (RLS) MUST be enabled on all app-specific tables (`MarketplaceUser`, `InstalledPlugin`). Policy: `using (id = auth.uid())`. Server routes use `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS by design. |
| PKCE authorization code replay attack | The authorization code is deleted from the database transactionally at the moment of redemption. Any subsequent attempt receives `400 invalid_grant`. |
| Supabase free tier limits magic link email to 2/hour per address | A custom SMTP provider (Resend) is configured in Supabase project settings before magic link is enabled in production. |
| `MarketplaceUser` becomes orphaned when `auth.users` row is deleted | A Postgres trigger on `auth.users` DELETE cascades to `MarketplaceUser` and all related rows. |
| Ed25519 signing key rotation causes token rejection at Data Engines | Signing keys are stored in a `SigningKey` DB table, not env vars. The JWKS endpoint serves all non-revoked keys simultaneously. During rotation, the old key is marked `retiring` and kept in JWKS for 10 minutes before being marked `revoked`. |

---

## Marketplace PKCE OAuth Server (Relation to ADR-001)

The Marketplace acts as the **OAuth 2.0 Authorization Server** in the ADR-001 PKCE flow. Supabase Auth handles user identity; a thin custom layer handles the code exchange:

1. Local App redirects user to `marketplace.worldwideview.dev/api/oauth/authorize`
2. Marketplace validates the Supabase session (or redirects to `worldwideview.dev/login`)
3. User sees consent screen and approves
4. Marketplace issues a short-lived authorization code (60s TTL), redirects to Local App
5. Local App exchanges code + `code_verifier` for a long-lived API Key
6. Subsequent plugin connections use the API Key to request 5-minute EdDSA JWTs (ADR-001B)

This is not a new Supabase feature — it is custom Next.js API routes sitting on top of the existing Supabase Auth session.

---

## Consequences

- **One Supabase project** is a shared dependency across `worldwideview-web`, `worldwideview-marketplace`, and `worldwideview` (Cloud App). A Supabase outage affects all products simultaneously. This is an accepted tradeoff at current scale; the mitigation is Supabase's SLA and free-tier generous limits.
- **`worldwideview-web` must run as a Node.js server**, not a static Nginx container. This increases Coolify resource usage marginally but enables all auth functionality.
- **Local development requires `mkcert` setup** (one-time, ~5 minutes). This is a deliberate decision to prevent a class of production bugs that cannot be caught with `localhost`.
- **The old `cloud-auth-architecture.md` rule is invalidated.** That rule stated `app.worldwideview.dev` owns all login UI and the Marketplace redirects there. The reverse is now true. That rules file must be updated to reference this ADR.
- **Upgrade path is clear:** If the Marketplace matures into a platform that third-party developers build against (issuing OAuth tokens to external apps), the existing PKCE layer is extended without changing the user table or Supabase project. The identity layer is already decoupled from the token exchange layer.

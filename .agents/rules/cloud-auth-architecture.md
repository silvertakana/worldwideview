---
trigger: model_decision
description: Cloud edition implementation details, PostgreSQL Row-Level Security (RLS) isolation, cross-subdomain auth, and cryptographic license keys.
---

# WorldWideView — Cloud & Auth Architecture


> [!NOTE]
> **This file contains the master plan and advanced implementation details for the future Cloud edition.**
> It covers single-container multi-tenancy, PostgreSQL Row-Level Security (RLS) isolation, cross-subdomain auth, and cryptographic license keys. It is intended for AI reference when building multi-tenant or auth-related features.

---

## Auth Strategy

**Auth.js (NextAuth)** is the single auth API across all editions. `app.worldwideview.dev` owns **all auth UI** — login, registration, password reset. No other subdomain ever shows a login or registration form.

```typescript
// src/lib/auth.ts
const providers = isCloud
  ? [SupabaseProvider({ /* delegates to Supabase Auth (GoTrue) */ })]
  : [Credentials({ /* local bcrypt + PostgreSQL */ })];

export const { auth, signIn, signOut } = NextAuth({ providers });
```

Application code is **identical** across editions — always calls `auth()`, `signIn()`, `signOut()`.

**One account for the entire ecosystem:**
- Cloud instance (`[user].app.worldwideview.dev`)
- Marketplace (browse, install, publish) — via SSO redirect
- Local instance Bridge API connection

**Marketplace never owns auth UI** — it redirects to `app.worldwideview.dev/login?redirect_to=marketplace...` for all sign-in.

---

## Registration & Auto-Provisioning

Registration: `app.worldwideview.dev/register`

```
1. User fills: email, password, username (= subdomain)
2. Account created (Supabase Auth)
3. Tenant row inserted instantly → [username].app.worldwideview.dev is live
4. User lands on their instance → Setup Wizard (Cesium token)
```

**Subdomain validation:** alphanumeric + hyphens, min 3 chars, not already taken.
**Reserved names:** `www`, `app`, `api`, `demo`, `marketplace`, `docs`, `status`, `admin`, `cdn`, `blog`, `changelog`

"Provisioning" is just inserting a database row — no container to spin up (multi-tenant shared app).

---

## Multi-Tenant Architecture

**One Docker container, RLS isolation.** All cloud tenants share one Next.js deployment. Data isolation enforced at the **PostgreSQL database level** via Row-Level Security:

```
nginx (wildcard *.app.worldwideview.dev)
  → reads subdomain → passes X-Tenant-ID header
  → single WWV Docker container (Next.js)
      → middleware reads X-Tenant-ID
      → sets app.tenant_id in DB connection
      → RLS scopes ALL queries to that tenant
```

```sql
ALTER TABLE installed_plugins ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON installed_plugins
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

PostgreSQL **physically refuses** to return other tenants' rows — even application bugs cannot leak data.

> Schema-per-tenant (stronger isolation) can be offered later for enterprise. The `tenant_id` design makes migration straightforward.

### Security Analysis

| Concern | Risk | Mitigation |
|---|---|---|
| Data bleed between tenants | 🔴 Critical | RLS enforced at PostgreSQL level |
| One tenant crashes the app | 🟡 Medium | Next.js request isolation. Rate limit per tenant at nginx |
| One tenant hammers CPU | 🟡 Medium | Rate limiting at nginx (req/min per subdomain) |
| Plugin code between tenants | 🟢 Low | Plugins run in the user's **browser**, not the server |
| Server crash from users | 🟢 Low | Users can't run arbitrary server code. Rate limits handle abuse |

---

## Storage & Database

| Feature | Local | Cloud |
|---|---|---|
| **Database queries** | Prisma → PostgreSQL | Prisma → PostgreSQL (Supabase) |
| **Auth** | None (single owner) | Supabase Auth (GoTrue) |
| **File storage** | Local filesystem (`data/`) | Supabase Storage |
| **Storage limit** | ∞ (your disk) | Quota enforced per tier |

**Prisma is write-once, deploy-anywhere** — the same queries and schema work on both databases. `DATABASE_URL` in `.env` is the only difference.

---

## Tier Matrix

| Deployment | `NEXT_PUBLIC_WWV_EDITION` | License Key | Users | Storage |
|---|---|---|---|---|
| **Demo** | `demo` | none | ∞ (anonymous, read-only) | N/A |
| Local Free | `local` | none | 1 (owner) | ∞ |
| Local Pro | `local` | Pro key | 1 (owner) | ∞ |
| Local Team | `local` | Team key | Unlimited | ∞ |
| Cloud Free | `cloud` | none | 3 | 500 MB |
| Cloud Pro | `cloud` | Pro key | 20 | 5 GB |
| Cloud Enterprise | `cloud` | Enterprise key | Unlimited | 50 GB+ |

### Cryptographic License Keys

Paid features gated by **RSA-signed JWTs** — users cannot forge them by flipping flags:

```typescript
// Marketplace signs (PRIVATE key — only you have this):
const licenseKey = jwt.sign(
  { tier: "pro", exp: "2027-01-01", org: "acme-corp" },
  PRIVATE_KEY, { algorithm: "RS256" }
);

// WWV verifies (PUBLIC key — hardcoded in codebase):
const license = jwt.verify(process.env.WWV_LICENSE_KEY, PUBLIC_KEY);
// license.tier = "free" | "pro" | "team"
```

### Storage Quota (Cloud Only)

- **Counts:** Imported GeoJSON, plugin data history, uploaded assets
- **NOT counted:** Built-in plugin real-time data (transient)
- **Quota exceeded:** Upgrade prompt, reject new imports, allow read access

---

## Environment Variables

### Local `.env`
```env
NEXT_PUBLIC_WWV_EDITION=local
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wwv?schema=public
```

### Cloud `.env`
```env
NEXT_PUBLIC_WWV_EDITION=cloud
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
WWV_TENANT_MODE=rls
WWV_STORAGE_PROVIDER=supabase
```

### Demo `.env`
```env
NEXT_PUBLIC_WWV_EDITION=demo
DATABASE_URL=postgresql://...
```

`.env` is **infrastructure only** — things the operator sets once. Everything user-configurable lives in the `settings` DB table.

---

## Edition Adapters

Three thin files are all that differs between editions — everything else is edition-unaware:

| Adapter | Local | Cloud | Demo |
|---|---|---|---|
| `src/core/auth.ts` | Auth.js `Credentials` (bcrypt + PostgreSQL) | Auth.js `@auth/supabase-adapter` | Disabled |
| `src/core/storage.ts` | `fs.writeFile()` to `data/` | Supabase Storage SDK | Read-only |
| `src/core/tenant.ts` | No-op (single tenant) | Sets `app.tenant_id` for RLS | No-op |

---

## Bot Prevention (Layered)

| Layer | What | Cost |
|---|---|---|
| **Email verification** | Supabase Auth built-in | Free |
| **Rate limiting** | 3 signups per IP per hour (nginx) | Free |
| **Cloudflare Turnstile** | Invisible CAPTCHA on signup | Free |
| **Cloudflare Bot Fight Mode** | Auto-enabled on free tier | Free |

---

## CI/CD Pipeline

```
Push to silvertakana/worldwideview
  → GitHub Actions: build Docker image
  → Push to ghcr.io/silvertakana/worldwideview:latest
  → Coolify webhook triggers
  → Rolling restart (zero downtime)
```

### `worldwideview-cloud/docker-compose.yml` (concept)
```yaml
services:
  wwv-cloud:
    image: ghcr.io/silvertakana/worldwideview:latest
    environment:
      NEXT_PUBLIC_WWV_EDITION: cloud
      DATABASE_URL: ${SUPABASE_PG_URL}
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
    labels:
      - "traefik.http.routers.wwv.rule=HostRegexp(`{user:[a-z0-9-]+}.app.worldwideview.dev`)"
```

The cloud repo (`worldwideview-cloud`) holds **no application logic** — it is purely a thin deployment configuration layer that pulls versioned Docker images.

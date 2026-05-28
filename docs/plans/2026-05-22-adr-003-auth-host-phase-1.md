# WorldWideView Auth Rollout — ADR-001 + ADR-003

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` to implement
> this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get ADR-001 (decentralized plugin auth) and ADR-003 (shared ecosystem identity)
into production with the least possible downtime. `/cloud` plan registration and billing
are deferred.

**Architecture:** One shared Supabase project is the identity store. `worldwideview.dev`
(the `worldwideview-web` repo) becomes the SSR auth host; a parent-domain cookie
(`.worldwideview.dev`) is inherited by every subdomain. The Marketplace becomes a PKCE
OAuth server on top of that session. The Local App is the PKCE client. The Data Engine
validates 5-minute JWTs on its WebSocket.

**Tech Stack:** Next.js 16 App Router, `@supabase/ssr`, Supabase Auth, Ed25519 JWTs
(`jose`), Prisma, Docker + Coolify.

---

## Northstar Sequence (the map)

Build everything locally on `wwv.local` HTTPS first, then deploy production one repo at a
time in this dependency order. Each deploy is independently revertible.

1. **Phase 0** — Provision Supabase + local HTTPS dev (human setup — see checklist below).
2. **Phase 1** — `worldwideview-web` becomes the SSR auth host. ← **detailed below**
3. **Phase 2** — Marketplace consumes the session + adds the PKCE OAuth server.
4. **Phase 3** — Merge the ADR-001 Local App worktree.
5. **Phase 4** — Data Engine WebSocket first-message JWT auth (report-only → enforcing).
6. **Phase 5** — Final cutover, link the nav, update docs, mark ADRs Accepted.

Phases 2–5 are detailed once Phase 1 lands and Assumption #2 (below) is confirmed.

---

## Phase 0 — Human Setup Checklist (do this while Phase 1 code is written)

These cannot be automated — they need accounts, browsers, admin rights, or a DNS panel.

- [ ] **0.1 Create the Supabase project.** supabase.com → New project. Pick a region close
  to the Coolify host. Save the DB password. Copy three values: Project URL, `anon` public
  key, `service_role` secret key.
- [ ] **0.2 Enable auth providers** (Supabase dashboard → Authentication → Providers):
  - Email: enable, "Confirm email" ON.
  - Google: create an OAuth Client in Google Cloud Console (APIs & Services → Credentials →
    OAuth client ID → Web app). Authorized redirect URI:
    `https://<project-ref>.supabase.co/auth/v1/callback`. Paste Client ID + Secret into
    Supabase.
  - GitHub: GitHub → Settings → Developer settings → OAuth Apps → New. Authorization
    callback URL: `https://<project-ref>.supabase.co/auth/v1/callback`. Paste Client ID +
    Secret into Supabase.
- [ ] **0.3 Set URL configuration** (Authentication → URL Configuration):
  - Site URL: `https://worldwideview.dev`
  - Redirect URLs (add all): `https://worldwideview.dev/**`,
    `https://*.worldwideview.dev/**`, `https://wwv.local/**`, `https://*.wwv.local/**`
- [ ] **0.4 Install mkcert** (one-time, per dev machine). PowerShell as admin:
  `choco install mkcert` then `mkcert -install`.
- [ ] **0.5 Generate the local TLS cert.** In `c:\dev\wwv`:
  `mkcert "*.wwv.local" wwv.local` — produces a `.pem` cert + key pair.
- [ ] **0.6 Edit the hosts file** (admin). Add to `C:\Windows\System32\drivers\etc\hosts`:
  `127.0.0.1 wwv.local marketplace.wwv.local app.wwv.local`
- [ ] **0.7 Confirm production DNS.** `worldwideview.dev`, `marketplace.worldwideview.dev`,
  `app.worldwideview.dev` (and a `*.worldwideview.dev` wildcard) must point at the Coolify
  host. Check the DNS provider; add records if missing.
- [ ] **0.8 Decide Assumption #2** — Marketplace keeps SQLite, or migrates to Supabase
  Postgres? (See "Assumptions" at the end. This unblocks the Phase 2 detailed plan.)
- [ ] **0.9 Hand me the Supabase values** (or paste them yourself) so they can go into the
  local `.env` files and the Coolify env vars — never committed to git. Needed:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] **0.10 (Optional) Resend SMTP** — only if launching with magic-link login. Create a
  Resend account, verify a sending domain, paste SMTP creds into Supabase → Project
  Settings → Auth → SMTP. Skip if launching with email+password + OAuth only.

---

# Phase 1 Implementation Plan — `worldwideview-web` Auth Host

**Repo:** `c:\dev\wwv\worldwideview-web`
**Outcome:** `worldwideview.dev` serves the landing site (static) plus working SSR
`/login`, `/signup`, `/accounts`, and `/api/auth/callback`, with sessions written to a
parent-domain cookie. The container runs as Node, not Nginx.

### File Structure

| File | Responsibility |
|---|---|
| `next.config.ts` | Drop static export, switch to `standalone`, add headers |
| `vitest.config.ts` (new) | Unit test runner config |
| `src/lib/supabase/cookieOptions.ts` (new) | Pure helper: resolve cookie domain from env |
| `src/lib/supabase/cookieOptions.test.ts` (new) | Unit tests for the helper |
| `src/lib/supabase/client.ts` | Browser client via `@supabase/ssr` |
| `src/lib/supabase/server.ts` (new) | Server client via `@supabase/ssr` |
| `middleware.ts` (new) | Refresh the session on every request |
| `src/app/api/health/route.ts` (new) | Health endpoint for Coolify deploy gating |
| `src/app/login/page.tsx` | SSR login: email+password + OAuth |
| `src/app/login/actions.ts` (new) | Server action: password sign-in |
| `src/app/login/oauth-buttons.tsx` (new) | Client component: Google/GitHub buttons |
| `src/app/signup/page.tsx` (new) | SSR signup |
| `src/app/signup/actions.ts` (new) | Server action: account creation |
| `src/app/accounts/page.tsx` (new) | Account view + logout |
| `src/app/accounts/actions.ts` (new) | Server action: sign out |
| `src/app/api/auth/callback/route.ts` (new) | OAuth code → session exchange |
| `Dockerfile` | Node standalone runtime instead of Nginx |
| `docker-compose.yml` | Port mapping for the Node container |
| `.env.local` (new, not committed) | Local Supabase + cookie-domain vars |

---

### Task 1: Add dependencies and the test runner

**Files:** Modify `package.json`; Create `vitest.config.ts`; Create `.env.local`.

- [ ] **Step 1: Install `@supabase/ssr`.**

Run in `c:\dev\wwv\worldwideview-web`:
```bash
pnpm add @supabase/ssr
```
Expected: `@supabase/ssr` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Add a `test` script.** In `package.json` `scripts`, add:
```json
"test": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.ts`.**
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 4: Create `.env.local`** (NOT committed — confirm it is in `.gitignore`):
```
NEXT_PUBLIC_SUPABASE_URL=<from Phase 0.1>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Phase 0.1>
NEXT_PUBLIC_WWV_COOKIE_DOMAIN=.wwv.local
```

- [ ] **Step 5: Verify the `@supabase/ssr` API.** Use context7 (`resolve-library-id`
  → `query-docs` for `@supabase/ssr` "Next.js App Router server client middleware") to
  confirm `createServerClient` / `createBrowserClient` signatures match the installed
  version before writing Tasks 3–4. The `getAll`/`setAll` cookie pattern below is the
  stable pattern; adjust only if the installed version differs.

- [ ] **Step 6: Commit.**
```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: add @supabase/ssr and vitest runner"
```

---

### Task 2: Cookie-domain resolver helper (TDD)

The cookie `domain` must be `.worldwideview.dev` in production, `.wwv.local` in dev, and
**unset** when running on plain `localhost` (browsers reject a `domain` on `localhost`).
This is the one piece of pure logic worth a unit test.

**Files:** Create `src/lib/supabase/cookieOptions.ts`,
`src/lib/supabase/cookieOptions.test.ts`.

- [ ] **Step 1: Write the failing test.** `src/lib/supabase/cookieOptions.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { resolveCookieDomain } from './cookieOptions'

describe('resolveCookieDomain', () => {
  it('returns undefined when nothing is configured', () => {
    expect(resolveCookieDomain(undefined)).toBeUndefined()
  })
  it('returns undefined for an empty string', () => {
    expect(resolveCookieDomain('')).toBeUndefined()
  })
  it('returns the configured domain', () => {
    expect(resolveCookieDomain('.worldwideview.dev')).toBe('.worldwideview.dev')
  })
  it('trims surrounding whitespace', () => {
    expect(resolveCookieDomain('  .wwv.local  ')).toBe('.wwv.local')
  })
})
```

- [ ] **Step 2: Run the test, confirm it fails.**
Run: `pnpm test`
Expected: FAIL — `resolveCookieDomain` is not exported / file not found.

- [ ] **Step 3: Implement `src/lib/supabase/cookieOptions.ts`.**
```ts
export function resolveCookieDomain(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim()
  return trimmed ? trimmed : undefined
}

export function buildCookieOptions() {
  return {
    domain: resolveCookieDomain(process.env.NEXT_PUBLIC_WWV_COOKIE_DOMAIN),
    path: '/',
    sameSite: 'lax' as const,
    secure: true,
  }
}
```

- [ ] **Step 4: Run the test, confirm it passes.**
Run: `pnpm test`
Expected: PASS — 4 passing.

- [ ] **Step 5: Commit.**
```bash
git add src/lib/supabase/cookieOptions.ts src/lib/supabase/cookieOptions.test.ts
git commit -m "feat: add cookie-domain resolver for cross-subdomain sessions"
```

---

### Task 3: Supabase browser + server clients

**Files:** Modify `src/lib/supabase/client.ts`; Create `src/lib/supabase/server.ts`.

- [ ] **Step 1: Rewrite `src/lib/supabase/client.ts`** (browser client — now a factory):
```ts
import { createBrowserClient } from '@supabase/ssr'
import { buildCookieOptions } from './cookieOptions'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: buildCookieOptions() },
  )
}
```

- [ ] **Step 2: Create `src/lib/supabase/server.ts`** (server client):
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { buildCookieOptions } from './cookieOptions'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: buildCookieOptions(),
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component — middleware refreshes instead.
          }
        },
      },
    },
  )
}
```

- [ ] **Step 3: Migrate existing importers of the old `supabase` singleton.**
Run: `grep -rn "lib/supabase/client" src/` — every hit that did `import { supabase }`
must change to `import { createClient }` + `const supabase = createClient()`. The `hub/`
page is a known importer. Update each.

- [ ] **Step 4: Verify the build typechecks.**
Run: `pnpm build`
Expected: build proceeds past type-checking (it may still fail later on `output: export`
+ middleware — that is fixed in Task 5; a clean `tsc` pass here is the goal).

- [ ] **Step 5: Commit.**
```bash
git add src/lib/supabase/client.ts src/lib/supabase/server.ts src/app/hub
git commit -m "feat: add @supabase/ssr browser and server clients"
```

---

### Task 4: Session-refresh middleware

**Files:** Create `middleware.ts` (repo root, sibling of `src/`).

- [ ] **Step 1: Create `middleware.ts`.**
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { buildCookieOptions } from './src/lib/supabase/cookieOptions'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: buildCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refreshes the session cookie if expired. Do NOT add logic between
  // createServerClient and getUser().
  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 2: Verify it compiles.**
Run: `pnpm build`
Expected: no type errors from `middleware.ts`.

- [ ] **Step 3: Commit.**
```bash
git add middleware.ts
git commit -m "feat: add session-refresh middleware"
```

---

### Task 5: Convert `next.config.ts` from static export to SSR

**Files:** Modify `next.config.ts`.

- [ ] **Step 1: Replace `next.config.ts` entirely.**
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
```
Note: any custom headers currently in `nginx.conf` should be folded into the `headers()`
array. Keep CSP out for now unless `nginx.conf` already had one — an over-strict CSP
silently breaks Supabase XHR calls.

- [ ] **Step 2: Build and confirm SSR mode.**
Run: `pnpm build`
Expected: build output lists routes as a mix of `○ (Static)` and `ƒ (Dynamic)`; auth
routes appear as Dynamic. No `out/` directory is produced; `.next/standalone` is.

- [ ] **Step 3: Commit.**
```bash
git add next.config.ts
git commit -m "feat: switch worldwideview-web from static export to standalone SSR"
```

---

### Task 6: Health endpoint

**Files:** Create `src/app/api/health/route.ts`.

- [ ] **Step 1: Create the route.**
```ts
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ status: 'ok' })
}
```

- [ ] **Step 2: Verify.**
Run: `pnpm build && pnpm start` then in another shell: `curl -i http://localhost:3000/api/health`
Expected: `200 OK`, body `{"status":"ok"}`.

- [ ] **Step 3: Commit.**
```bash
git add src/app/api/health/route.ts
git commit -m "feat: add health endpoint for deploy gating"
```

---

### Task 7: Login page (email+password + OAuth)

**Files:** Modify `src/app/login/page.tsx`; Create `src/app/login/actions.ts`,
`src/app/login/oauth-buttons.tsx`.

- [ ] **Step 1: Create `src/app/login/actions.ts`.**
```ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '/accounts')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`)
  }
  redirect(next)
}
```

- [ ] **Step 2: Create `src/app/login/oauth-buttons.tsx`.**
```tsx
'use client'

import { createClient } from '../../lib/supabase/client'
import styles from '../hub/hub.module.css'

export function OAuthButtons({ next }: { next: string }) {
  const signIn = async (provider: 'google' | 'github') => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      <button className={styles.submitButton} onClick={() => signIn('google')} type="button">
        Continue with Google
      </button>
      <button className={styles.submitButton} onClick={() => signIn('github')} type="button">
        Continue with GitHub
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Rewrite `src/app/login/page.tsx`** as a server component:
```tsx
import { signInWithPassword } from './actions'
import { OAuthButtons } from './oauth-buttons'
import styles from '../hub/hub.module.css'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const { error, next = '/accounts' } = await searchParams

  return (
    <div className={styles.hubContainer}>
      <div className={styles.glassCard} style={{ maxWidth: '400px', marginTop: '10vh' }}>
        <h1 className={styles.title}>Welcome Back</h1>
        <p style={{ textAlign: 'center', marginBottom: 'var(--space-lg)', color: 'var(--text-secondary)' }}>
          Sign in to your WorldWideView account
        </p>

        <form action={signInWithPassword}>
          <input type="hidden" name="next" value={next} />
          <input className={styles.inputField} type="email" name="email"
            placeholder="Email address" required />
          <input className={styles.inputField} type="password" name="password"
            placeholder="Password" required />
          <button className={styles.submitButton} type="submit">Sign In</button>
        </form>

        <div style={{ textAlign: 'center', margin: 'var(--space-md) 0', color: 'var(--text-secondary)' }}>
          or
        </div>
        <OAuthButtons next={next} />

        {error && (
          <p style={{ marginTop: 'var(--space-md)', textAlign: 'center', fontSize: '0.9rem',
            color: 'var(--color-accent)' }}>
            {error}
          </p>
        )}

        <p style={{ marginTop: 'var(--space-md)', textAlign: 'center', fontSize: '0.9rem' }}>
          No account? <a href={`/signup?next=${encodeURIComponent(next)}`}>Create one</a>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify.**
Run: `pnpm build`
Expected: `/login` builds as a Dynamic route, no type errors.

- [ ] **Step 5: Commit.**
```bash
git add src/app/login
git commit -m "feat: SSR login with email/password and OAuth"
```

---

### Task 8: Signup page

**Files:** Create `src/app/signup/page.tsx`, `src/app/signup/actions.ts`.

- [ ] **Step 1: Create `src/app/signup/actions.ts`.**
```ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'

export async function signUp(formData: FormData) {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '/accounts')

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/auth/callback?next=${encodeURIComponent(next)}` },
  })

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`)
  }
  redirect(`/login?message=${encodeURIComponent('Check your email to confirm your account.')}&next=${encodeURIComponent(next)}`)
}
```
Note: add `NEXT_PUBLIC_SITE_URL` to `.env.local` (`https://wwv.local`) and to Coolify
(`https://worldwideview.dev`).

- [ ] **Step 2: Create `src/app/signup/page.tsx`.**
```tsx
import { signUp } from './actions'
import styles from '../hub/hub.module.css'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const { error, next = '/accounts' } = await searchParams

  return (
    <div className={styles.hubContainer}>
      <div className={styles.glassCard} style={{ maxWidth: '400px', marginTop: '10vh' }}>
        <h1 className={styles.title}>Create Account</h1>
        <form action={signUp}>
          <input type="hidden" name="next" value={next} />
          <input className={styles.inputField} type="email" name="email"
            placeholder="Email address" required />
          <input className={styles.inputField} type="password" name="password"
            placeholder="Password (8+ characters)" minLength={8} required />
          <button className={styles.submitButton} type="submit">Sign Up</button>
        </form>
        {error && (
          <p style={{ marginTop: 'var(--space-md)', textAlign: 'center', fontSize: '0.9rem',
            color: 'var(--color-accent)' }}>
            {error}
          </p>
        )}
        <p style={{ marginTop: 'var(--space-md)', textAlign: 'center', fontSize: '0.9rem' }}>
          Already have an account? <a href={`/login?next=${encodeURIComponent(next)}`}>Sign in</a>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify.** Run: `pnpm build` — `/signup` builds as Dynamic.

- [ ] **Step 4: Commit.**
```bash
git add src/app/signup
git commit -m "feat: SSR signup page"
```

---

### Task 9: OAuth callback route

**Files:** Create `src/app/api/auth/callback/route.ts`.

- [ ] **Step 1: Create the route.**
```ts
import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/accounts'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Authentication failed')}`)
}
```

- [ ] **Step 2: Verify.** Run: `pnpm build` — route compiles.

- [ ] **Step 3: Commit.**
```bash
git add src/app/api/auth/callback/route.ts
git commit -m "feat: OAuth callback route for code-to-session exchange"
```

---

### Task 10: Accounts page + logout

**Files:** Create `src/app/accounts/page.tsx`, `src/app/accounts/actions.ts`.

- [ ] **Step 1: Create `src/app/accounts/actions.ts`.**
```ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

- [ ] **Step 2: Create `src/app/accounts/page.tsx`** (guards unauthenticated users):
```tsx
import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'
import { signOut } from './actions'
import styles from '../hub/hub.module.css'

export default async function AccountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/accounts')
  }

  return (
    <div className={styles.hubContainer}>
      <div className={styles.glassCard} style={{ maxWidth: '480px', marginTop: '10vh' }}>
        <h1 className={styles.title}>Your Account</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{user.email}</p>
        <form action={signOut}>
          <button className={styles.submitButton} type="submit">Sign Out</button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify.** Run: `pnpm build` — `/accounts` builds as Dynamic.

- [ ] **Step 4: Commit.**
```bash
git add src/app/accounts
git commit -m "feat: account page with parent-domain logout"
```

---

### Task 11: Dockerfile → Node standalone runtime

**Files:** Modify `Dockerfile`; verify `.dockerignore`; modify `docker-compose.yml`.

- [ ] **Step 1: Replace `Dockerfile` entirely.**
```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml* ./
RUN pnpm i --frozen-lockfile
COPY . .

# NEXT_PUBLIC_* vars are inlined at build time — must be present as build args.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_WWV_COOKIE_DOMAIN
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_WWV_COOKIE_DOMAIN=$NEXT_PUBLIC_WWV_COOKIE_DOMAIN
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

RUN pnpm run build

# Stage 2: Runtime
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
```

- [ ] **Step 2: Confirm `.dockerignore` excludes `node_modules`, `.next`, `out`.**
If missing, create `.dockerignore` with: `node_modules`, `.next`, `out`, `.git`.

- [ ] **Step 3: Update `docker-compose.yml`** so the web service maps a host port to
container `3000` (was Nginx `80`), e.g. `ports: - "3001:3000"`, and passes the four
`NEXT_PUBLIC_*` build args.

- [ ] **Step 4: Build the image locally.**
Run: `docker build -t wwv-web-test .`
Expected: build completes; the final image runs `node server.js`.

- [ ] **Step 5: Commit.**
```bash
git add Dockerfile .dockerignore docker-compose.yml
git commit -m "feat: run worldwideview-web as a Node standalone container"
```
Note: `nginx.conf` is now unused — delete it in Phase 5 cleanup once production is verified.

---

### Task 12: Bump version

**Files:** Modify `package.json`.

- [ ] **Step 1:** Bump `version` `0.5.0` → `0.6.0` (a feature release — new auth surface).
- [ ] **Step 2: Commit.**
```bash
git add package.json
git commit -m "chore: bump version to 0.6.0"
```

---

## Phase 1 Verification

**Local (on `wwv.local` HTTPS — requires Phase 0.4–0.6 done):**
1. Run the dev server bound to `wwv.local` over HTTPS (via the mkcert cert or a local TLS
   proxy). Open `https://wwv.local/signup`.
2. Create an account → confirm the email → land back authenticated.
3. Sign out, then `https://wwv.local/login` with email+password → reach `/accounts`.
4. In DevTools → Application → Cookies: the Supabase `sb-*` cookies have
   `Domain = .wwv.local`.
5. Test Google and GitHub buttons → provider → `/api/auth/callback` → `/accounts`.
6. `https://wwv.local/accounts` while logged out → redirect to `/login?next=/accounts`.
7. Sign out → cookies cleared on `.wwv.local`.
8. `curl -k https://wwv.local/api/health` → `{"status":"ok"}`.
9. Marketing pages (`/`, `/about`, `/docs`) still load and are statically generated.

**Production deploy (the one downtime-sensitive cutover):**
1. Push the branch, open a PR, run `/pr-review`.
2. In Coolify: update the `worldwideview-web` app — new Dockerfile build, set the four
   `NEXT_PUBLIC_*` build args + runtime env vars, set the health check to `/api/health`.
3. **Safest:** deploy first to a temporary domain (`web-next.worldwideview.dev`), smoke-test
   the full flow, then repoint `worldwideview.dev` (blue-green). Otherwise rely on Coolify's
   health-check-gated deploy so traffic only switches after `/api/health` passes.
4. After cutover: smoke-test `worldwideview.dev` landing + `/login` + `/signup`.

---

## Assumptions / Open Questions

1. **No Supabase project exists yet** — Phase 0 creates one.
2. **Marketplace keeps SQLite (Option A)** — recommended: the Marketplace consumes the
   Supabase *session* for identity but keeps plugin/API-key data in SQLite. If you want a
   full SQLite → Supabase-Postgres migration instead, Phase 2 is much larger. **This is the
   one decision that changes scope — please confirm (Phase 0.8).**
3. **`/cloud` + billing deferred** — `/accounts` is minimal (profile + logout), no Stripe.
4. **API-key management UI lives in the Marketplace** (ADR-001C wording), not in `/accounts`.
5. **`SigningKey` rotation table** treated as a fast-follow, not a launch blocker.
6. **The ADR-001 worktree branch needs consolidation** before merge (messy branch name,
   uncommitted changes) — handled in Phase 3.
7. **`hub.module.css` is reused** for auth page styling to avoid new CSS scope. If you want
   dedicated auth styling, that is an easy add but not assumed here.
8. **No Playwright in `worldwideview-web`** — Phase 1 verification is browser-manual. Adding
   a Playwright E2E suite is a reasonable but separate follow-up.

---

## Phase 1 — Implemented & Verified (2026-05-22)

All 12 implementation tasks done. `pnpm test` 16/16 green; `pnpm build` green (marketing
pages Static, the 5 auth routes Dynamic, middleware active). `.env.local` verified against
the live Supabase project `kvlnzjtcstnaqkpqrquf` — URL + publishable key match. The new
API-key system is used throughout (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`); `getClaims()`
for session checks.

### Discovered at commit time: pre-existing uncommitted work (NOT Phase 1)

The `worldwideview-web` working tree already held a separate, coherent change —
**"consolidate docs off the `docs.` subdomain back onto `/docs`"**:

- `src/proxy.ts` — **deleted** (was the `docs.` subdomain rewrite middleware; used Next 16's
  `proxy.ts` convention with `export function proxy`)
- `src/app/docs/layout.tsx` — dropped the `NEXT_PUBLIC_IS_DOCS_SUBDOMAIN` branching
- `src/components/Footer.tsx` — docs links `docs.worldwideview.dev` → `/docs`
- `vercel.json` — removed the docs-subdomain redirects (now `{}`)
- `.vscode/settings.json` — new untracked file

This is unrelated to the auth host. **Decision (user, 2026-05-22): commit the
docs-consolidation work first as its own commit, then Phase 1.**

### Finalized commit sequence (branch `feat/auth-host` off `main`)

1. **Commit 1 — docs consolidation.** Stage only: `src/proxy.ts` (deletion),
   `src/app/docs/layout.tsx`, `src/components/Footer.tsx`, `vercel.json`. Message:
   `refactor(docs): serve docs from /docs instead of the docs. subdomain`.
2. **Rename** Phase 1's root `middleware.ts` → `src/proxy.ts` (`export function proxy`).
   Clean now — Commit 1 removed the old `src/proxy.ts`, so Commit 2 just adds the new auth
   one. Matches the repo's Next-16 `proxy.ts` convention.
3. **Commit 2 — Phase 1.** Version bump `0.5.0 → 0.6.0`; stage all Phase 1 files. Message:
   `feat: add SSR auth host with shared Supabase identity (ADR-003)`.
4. Push `feat/auth-host`, open the PR (remote: `github.com/silvertakana/worldwideview-web`).

`.vscode/settings.json` (stray untracked file) is left out of both commits.

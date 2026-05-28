# ADR-0004: Supabase Session Cookies Are httpOnly Across the Ecosystem

## Status
Accepted *(2026-05-25)*

## Date
2026-05-25

## Related
- **Builds on:** ADR-0003 (Shared Identity & Ecosystem Auth Host) — defines the parent-domain cookie scoping (`.worldwideview.dev` prod, `.wwv.local` dev) that this ADR hardens.

---

## Context

ADR-0003 established that a single Supabase session cookie scoped to the parent domain is inherited by every product subdomain (`marketplace.*`, `app.*`, the apex). The cookie carries a base64-encoded access token, refresh token, and the full user record. By default `@supabase/ssr` does NOT set `httpOnly` on this cookie because the browser client (`createBrowserClient`) needs to read it via `document.cookie` to compute `getSession()` synchronously without a network round-trip.

That default is fine for apps that perform their auth reads on the client. It is **not fine for this ecosystem.** Three observations forced the decision:

1. The `worldwideview-marketplace` repo already shipped with `httpOnly: true` in `buildCookieOptions()`. Its install gate (`requireSupabaseUser` in `src/lib/auth/requireSession.ts`) and every API route read the session through the server client (`createServerClient`), so a non-readable cookie costs nothing.

2. The `worldwideview-web` repo originally omitted `httpOnly` and had a single client-side reader: `src/app/hub/layout.tsx` ran `supabase.auth.getSession()` inside a `useEffect`. During audit (2026-05-25), this was discovered as the *only* JS path that needed cookie readability — and it was an anti-pattern (auth gate via `useEffect` introduces a flash-of-unauthenticated-content and is replaceable with a server component).

3. With the cookie readable to JS, an XSS payload on **any** subdomain (`marketplace.*`, `app.*`, the apex itself) can exfiltrate the full session token. Given marketplace renders user-submitted plugin metadata, this is a real attack surface.

The choice was: keep client-side `getSession()` calls and accept the XSS exfiltration risk, or refactor reads to server-side and harden the cookie.

---

## Decision

**All Supabase session cookies in the WorldWideView ecosystem are set with `httpOnly: true`.** This is enforced in each app's `buildCookieOptions()` helper:

- `worldwideview-web/src/lib/supabase/cookieOptions.ts`
- `worldwideview-marketplace/src/lib/supabase/cookieOptions.ts`
- `worldwideview/src/lib/supabase/cookieOptions.ts` (cloud edition only — file is gated by `isCloud`)

Companion hard constraint: **client-side `supabase.auth.getSession()` / `getUser()` / `getClaims()` is forbidden everywhere in the ecosystem.** All auth reads happen server-side via:

- Server components / pages — call `createClient()` from `src/lib/supabase/server.ts`, then `auth.getClaims()` (validates against the auth server, doesn't trust the cookie).
- API routes — same pattern, typically through a wrapper like `requireSupabaseUser(returnTo)`.
- Middleware / proxy — Next.js 16's `proxy.ts` refreshes the session on every matched request and propagates rotated cookies onto the response.

If a future feature requires reading the session on the client, it MUST go through a server-rendered prop or a fetch to an internal API route that performs the read server-side. Adding a new client-side auth read is a regression.

### Implementation details

```ts
// Shared shape across all three apps:
export function buildCookieOptions() {
  return {
    domain: resolveCookieDomain(process.env.NEXT_PUBLIC_WWV_COOKIE_DOMAIN),
    path: '/',
    sameSite: 'lax' as const,
    secure: true,
    httpOnly: true,   // ← this ADR
  }
}
```

The `proxy.ts` middleware in worldwideview-web (and the equivalent server-client invocations everywhere else) passes `cookieOptions: buildCookieOptions()` into `createServerClient` so token refreshes inherit the flag automatically.

---

## Consequences

**Positive:**
- XSS on any subdomain can no longer read the session token. The auth server still validates each request, so even a forged cookie has no value.
- Auth state is server-rendered, removing the flash-of-unauthenticated-content on protected routes (previously visible at `/hub`).
- Codebase is consistent — three apps, one cookie configuration, one set of read patterns.

**Negative / accepted tradeoffs:**
- Client-side `supabase.auth.*` reads are dead. Any contributor who has worked with `@supabase/supabase-js` will instinctively reach for `getSession()` in a `useEffect`. Code review must catch this.
- Token refresh on stale tabs requires a server round-trip through `proxy.ts` rather than a client-side refresh. Adds ~10-50ms to the first request after expiry; acceptable.
- Browser-side debugging is slightly harder — you can't paste `await supabase.auth.getUser()` into the devtools console. Use server logs or a dedicated `/api/debug/whoami` route instead.

**Verification at adoption (2026-05-25):**
- `worldwideview-web/src/app/hub/layout.tsx` refactored from client useEffect to server component (`getClaims()` + `redirect()`); test rewritten accordingly.
- Browser confirmation: after sign-out + sign-in, `document.cookie` no longer contains `sb-<ref>-auth-token.0/.1`; only the dev-mode `__next_hmr_refresh_hash__` cookie remains visible to JS.
- Marketplace and WWV cloud edition were already compliant; no behavior change for them.

---

## Enforcement

- Code review must flag any import of `createBrowserClient` from `@supabase/ssr` if the call site is in a `"use client"` component and invokes `auth.*` directly.
- Future ESLint rule: ban `createBrowserClient` + `auth.getUser|getSession|getClaims` combinations. (Not implemented yet — follow-up.)
- The marketplace browser client (`worldwideview-marketplace/src/lib/supabase/client.ts`) exists but is unused; consider deleting it in a future cleanup pass.

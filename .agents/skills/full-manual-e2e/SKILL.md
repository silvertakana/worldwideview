---
name: full-manual-e2e
description: User-triggered only. Invoke when the user explicitly runs /full-manual-e2e, or when /gsd:progress routes to manual verification. Do NOT auto-activate. Full WWV ecosystem E2E test script covering 3-server startup on https://wwv.local, chrome-devtools MCP browser driving, and 7-step auth+install validation flow.
---

# WWV Full Manual E2E

## Overview

The WorldWideView ecosystem is three Next.js apps that share a Supabase session via cookies scoped to `.wwv.local`. Testing the full install flow requires all three running simultaneously on HTTPS at sibling hostnames so the cookie domain trick works. This skill covers the exact commands, the gotchas that bite every time, and how to drive the browser via chrome-devtools MCP to validate each step.

## Architecture quick reference

| App | Local URL | Auth | Notes |
|---|---|---|---|
| `worldwideview-web` | `https://wwv.local:3001` | Supabase (`@supabase/ssr`) | Apex auth host. Owns `/login`, `/signup`, `/auth/callback`, `/accounts`. Refreshes session via `proxy.ts`. |
| `worldwideview-marketplace` | `https://marketplace.wwv.local:3002` | Supabase (cookie inherited) | Owns `/api/install/start` gate, `/api/instances*` routes, `InstanceCapture` + `InstanceHydrator`. |
| `worldwideview` (instance) | `https://wwv.local:3000` | NextAuth (local edition) | Local edition uses NextAuth credentials. Cloud edition delegates to the auth host. |

Shared Supabase session cookie: `sb-<project-ref>-auth-token.0/.1`, `Domain=.wwv.local`, `Secure=true`, `SameSite=Lax`. Different ports do NOT break cookie sharing (cookies are domain-based, not origin-based).

## Prerequisites (verify each — they are non-obvious)

1. **Hosts file** (Windows: `C:\Windows\System32\drivers\etc\hosts`, requires admin):
   ```
   127.0.0.1 wwv.local
   127.0.0.1 marketplace.wwv.local
   ```

2. **HTTPS in dev.** Either:
   - Run each server with `--experimental-https` (Next.js auto-generates a self-signed cert — browser warns once per host, click through)
   - OR run `mkcert -install` once + `mkcert "*.wwv.local" wwv.local` to get a trusted local CA

3. **Docker running** — only needed for the `worldwideview` instance (its `predev` script runs `prisma db push` against a Postgres container).

4. **Supabase project provisioned.** All three apps must point at the same `NEXT_PUBLIC_SUPABASE_URL` in their respective `.env.local`. The marketplace and worldwideview-web also need `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_WWV_COOKIE_DOMAIN=.wwv.local`.

5. **`NEXT_PUBLIC_AUTH_HOST_URL=https://wwv.local:3001`** set in marketplace `.env.local` so the install gate knows where to send unauthenticated users.

## Server startup (exact commands that work)

Each app's `pnpm dev` script varies — don't assume one command fits all. These are what actually work:

```powershell
# Terminal 1 — Auth host (worldwideview-web)
cd C:/dev/wwv/worldwideview-web
pnpm exec next dev --experimental-https --port 3001 -H wwv.local

# Terminal 2 — Marketplace
cd C:/dev/wwv/worldwideview-marketplace
pnpm exec next dev --webpack --experimental-https --port 3002 -H marketplace.wwv.local

# Terminal 3 — WWV instance (requires Docker)
cd C:/dev/wwv/worldwideview
pnpm dev
```

**Why `pnpm exec next dev` and not `pnpm dev` for the first two:** the marketplace `dev` script uses `--webpack` (mandatory — Turbopack breaks middleware), and we need to pass `-H` + `--port` which the npm script doesn't forward cleanly. WWV's `dev` script (`scripts/dev.mjs`) runs `concurrently` + handles predev (Docker boot, Prisma push, Cesium copy) — don't bypass it.

**Watching servers from inside an agent session:** use `Bash` with `run_in_background: true` for each, then `Monitor` with `tail -f <output> | grep --line-buffered -E "⨯|FAILED|Error:|TypeError|EADDR|ECONN|500"` for ongoing error notifications. Persistent monitors stay armed for the session.

## Common server-startup failures

| Symptom | Cause | Fix |
|---|---|---|
| `prisma db push --accept-data-loss` exits non-zero | Docker not running, Postgres unreachable | Start Docker Desktop, then `docker compose up -d wwv-db` from `worldwideview/`, then relaunch |
| `ENOENT: ...middleware.js.nft.json` during build | Next.js 16 renamed `middleware.ts` → `proxy.ts` | Rename the file and the exported function (`middleware` → `proxy`). Same APIs otherwise. |
| `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL` | Prisma 7 config file doesn't read `.env.local` automatically | `export DATABASE_URL="file:./prisma/registry.db"` before running prisma commands, OR run via the `pnpm dev` script which loads env |
| Cookie not visible on sibling subdomain | Wrong cookie domain or browser blocking insecure cookies | Verify `NEXT_PUBLIC_WWV_COOKIE_DOMAIN=.wwv.local` (leading dot mandatory). Cookies need `secure: true`, which requires HTTPS. |
| Browser keeps redirecting `?next=` to `/accounts` | `safeNext` rejecting cross-subdomain return URL | Confirm `worldwideview-web/src/lib/safeNext.ts` allows hostnames ending in `NEXT_PUBLIC_WWV_COOKIE_DOMAIN` |

## Driving the browser via chrome-devtools MCP

The MCP **drives the user's actual browser** — cookies, localStorage, and active sessions from prior testing persist across navigation. Treat it as live shared state, not a fresh fixture.

Tools loaded on first use via `ToolSearch`:
- `mcp__chrome-devtools__list_pages` — see open tabs
- `mcp__chrome-devtools__navigate_page` — `type=url|reload|back|forward`
- `mcp__chrome-devtools__new_page` — opens a new tab
- `mcp__chrome-devtools__take_snapshot` — a11y tree (preferred over screenshots for finding `uid=`s)
- `mcp__chrome-devtools__fill_form` — batch fill (use over individual `fill` calls)
- `mcp__chrome-devtools__click` — by `uid` from snapshot
- `mcp__chrome-devtools__wait_for` — by text content
- `mcp__chrome-devtools__evaluate_script` — arbitrary page JS (must be a function declaration, returns JSON)
- `mcp__chrome-devtools__list_network_requests` — `includePreservedRequests: true` to see across navigations
- `mcp__chrome-devtools__take_screenshot` — saves to a file path you specify

## The 7-step E2E test script

Run in this order. Each builds on the previous. After Step 3 the database has a `LinkedInstance` row that subsequent steps depend on.

### Step 1 — Sign up at the auth host

Navigate to `https://wwv.local:3001/signup`. Fill email + password, click Sign Up. Verify the email link. Expected landing: `/accounts` showing "Signed in as <email>".

Use Supabase dashboard → Auth → Users to confirm `email_confirmed_at` is set.

### Step 2 — Cookie cross-subdomain check

Same browser session. Open `https://marketplace.wwv.local:3002` in a new tab. The marketplace should recognise you as signed in.

Programmatic verification via `evaluate_script`:
```js
async () => {
  const probe = await fetch('/api/instances');
  return { status: probe.status, body: probe.status === 200 ? await probe.json() : null };
}
```
Expected: `status: 200`. (401 means the cookie didn't cross — check Domain attribute.)

### Step 3 — `?from_instance=` capture writes server-side

Navigate to `https://marketplace.wwv.local:3002/?from_instance=https%3A%2F%2Fwwv.local%3A3000`. Then:
```js
async () => {
  await new Promise(r => setTimeout(r, 1500));   // let InstanceCapture useEffect run
  const list = await fetch('/api/instances').then(r => r.json());
  return {
    ls: localStorage.getItem('wwv_instance_url'),
    urlStripped: !window.location.search.includes('from_instance'),
    list,
  };
}
```
Expected: `ls = "https://wwv.local:3000"`, URL param stripped, `list.instances` has one row matching the captured URL.

### Step 4 — Hydrator restores localStorage from server

```js
() => { localStorage.removeItem('wwv_instance_url'); return { cleared: true }; }
```
Then reload the page. Then:
```js
async () => {
  await new Promise(r => setTimeout(r, 2000));   // let Hydrator's fetch resolve
  return { ls: localStorage.getItem('wwv_instance_url') };
}
```
Expected: `ls` is repopulated with the most-recently-used instance URL. Network log should show one `GET /api/instances` (no `POST` — Hydrator only reads).

### Step 5 — Install gate redirects anonymous users to `?next=`

Delete the Supabase cookie (DevTools Application → Cookies → `.wwv.local` → delete `sb-...-auth-token.0/.1`). Click Install on any plugin browse page. Expected: 307 redirect to `https://wwv.local:3001/login?next=<full encoded install/start URL>`. After signing in, browser bounces back through `/api/install/start` to the WWV instance.

Direct test (no UI needed):
```js
async () => {
  const url = new URL('/api/install/start', location.origin);
  url.searchParams.set('pluginId', 'aviation');
  url.searchParams.set('version', '0.0.0');
  url.searchParams.set('manifest', 'eyJpZCI6ImF2aWF0aW9uIn0=');
  url.searchParams.set('instanceUrl', 'https://wwv.local:3000');
  url.searchParams.set('redirectTo', location.href);
  const res = await fetch(url.toString(), { redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location') };
}
```

### Step 6 — Picker appears for multi-instance users

Seed a second instance:
```js
await fetch('/api/instances/link', {
  method: 'POST', headers: {'content-type':'application/json'},
  body: JSON.stringify({ url: 'https://demo.wwv.local:9999' }),
});
```

**Gotcha:** the InstanceHydrator runs once on layout mount. If `localStorage.wwv_instance_url` is already set when the page loads, the Hydrator early-returns and the picker won't appear. To force the picker:

```js
() => {
  localStorage.removeItem('wwv_instance_url');
  // Click in the SAME tick so nothing async re-populates between clear and click.
  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Install Plugin'));
  btn.click();
  return { cleared: localStorage.getItem('wwv_instance_url') === null, clicked: !!btn };
}
```
Then `wait_for({ text: ["Choose your instance"] })`. Expected: modal lists both instances ordered by `lastUsedAt DESC` (most recent first), each labelled by nickname or `new URL(url).host`.

### Step 7 — Manage page rename / delete

Navigate to `https://marketplace.wwv.local:3002/manage`. The "Your linked instances" section lists rows. Click a nickname → type → blur → `PATCH /api/instances/<id>` fires. Click Remove → confirm → `DELETE /api/instances/<id>` fires.

## Critical gotchas (will burn you again)

1. **Chrome MCP drives the user's real browser**, not a sandboxed instance. Cookies, localStorage, and tabs from earlier testing persist. Always clear state explicitly when verifying a "cold load" scenario.

2. **The Hydrator only runs once per layout mount.** Full navigation re-mounts and re-runs it. Same-page state changes don't. To test the "cold device" flow, do `clear localStorage → click` in the same `evaluate_script` call so no async useEffect can re-populate between them.

3. **`secure: true` on the cookie requires HTTPS even in dev.** Plain `localhost:3000` cannot share cookies with `marketplace.localhost:3002`. The `wwv.local` hostname + HTTPS is mandatory.

4. **Cookies are domain-based, not origin-based.** `wwv.local:3000` and `wwv.local:3001` share cookies because the cookie's `domain=.wwv.local` ignores port. This is the only reason the auth host and the WWV instance can both run at `wwv.local` on different ports without conflict.

5. **Supabase session cookies are `httpOnly: true` ecosystem-wide (ADR-0004).** `document.cookie` will NOT show `sb-...-auth-token.0/.1`. All auth reads MUST be server-side (`createServerClient` → `auth.getClaims()` / `auth.getUser()`). Adding a client-side `supabase.auth.*` call is a regression — code review will flag it.

6. **WWV's `?from_instance=` originates from the local instance's "Browse plugins" button** (`worldwideview/src/components/panels/PluginsTab.tsx:70`). When testing the capture without WWV running, you can simulate by hand-crafting the URL.

7. **The marketplace install gate uses `?next=` not `?callbackUrl=`.** Standardized to match `worldwideview-web`'s `safeNext`. Don't mix them — `safeNext` ignores `?callbackUrl=` and silently redirects to `/accounts`.

8. **Turbopack + `@supabase/ssr` is broken in Next.js 16.2.3.** After HMR cycles you get `TypeError: adapterFn is not a function` from inside the proxy/middleware stack. Run worldwideview-web with `--webpack` until a known-good Turbopack version is verified. Marketplace `pnpm dev` already passes `--webpack` mandatorily — keep it. Full command: `pnpm exec next dev --experimental-https --webpack --port 3001 -H wwv.local`.

9. **Cookie-option changes only apply to newly-issued cookies.** If you edit `cookieOptions.ts` (e.g. flipping `httpOnly`) and reload, the browser still presents the OLD cookie until a token refresh or a fresh `signInWithPassword`. To verify a flag change, force a re-issue: sign out → sign in again. Don't trust a stale cookie inspection — it shows the old state.

10. **Next.js dev server OOMs after ~60 minutes of heavy use.** Symptom: V8 mark-compact failures around 16 GB heap (`FATAL ERROR: Ineffective mark-compacts near heap limit`), process exits with code 134 (SIGABRT). Restart the dev server every ~45 min during long E2E sessions. If the port stays bound after crash (`EADDRINUSE 3001`), kill the orphan: `Get-Process -Id (Get-NetTCPConnection -LocalPort 3001 -State Listen).OwningProcess | Stop-Process -Force` (PowerShell). The Git-Bash `taskkill /PID <n> /F` does NOT work — it mangles the flag.

11. **Prisma 7 + TypeScript config doesn't auto-load `.env.local`.** `pnpm prisma db push` (or any prisma CLI) fails with `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL` unless the variable is in the shell environment. Fix: `export DATABASE_URL="file:./prisma/registry.db"` before the prisma command, OR run prisma via the `pnpm dev` script which loads env first.

12. **Hydrator overwrites stale localStorage on every cold mount (ADR/UX choice).** Don't assume `localStorage.wwv_instance_url` survives across page loads — the `InstanceHydrator` always re-syncs to the server's most-recent `LinkedInstance`. To test the picker, you must clear localStorage AND click Install in the same `evaluate_script` tick, or the Hydrator's `useEffect` will re-populate before you can interact.

## Verification checklist before closing the session

- [ ] All three servers still running (check `Monitor` task IDs aren't dead)
- [ ] No unhandled errors fired in any server's log monitor during your session
- [ ] DB rows you created (`LinkedInstance` etc.) are cleaned up or you've noted them for the next session
- [ ] Cookie state in browser matches what your test expects (don't leave half-deleted cookies for the next session)
- [ ] Stop background server tasks if you don't need them: `TaskStop` with each `task_id`

## What this skill does NOT cover

- The cloud edition WWV flow (not implemented yet — local edition only).
- The full install completion at the WWV instance (requires Docker + Postgres + plugin DB seed). Stop after the install-redirect 302 is sufficient for verifying the marketplace gate; the WWV-side install is its own scope.
- E2E for the Playwright suite (those run headless in CI; see `worldwideview/tests/marketplace-from-instance.spec.ts` and the `e2e-testing.md` rule).
- mkcert setup details — covered well by `mkcert -install` docs.

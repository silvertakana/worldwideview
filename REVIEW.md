# Code Review: `fix/ci-marketplace-status-type`

**Reviewed:** 2026-06-14T18:00:00Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

This branch mixes **CI infrastructure fixes**, **a proper React lint refactor**, **a security log dedup improvement**, and — most concerningly — **an unrelated feature (tactical theme)** into a single branch. The branch claims to fix CI marketplace status type errors but also introduces a new visual theme, CSS classes, theme-tokens, Zustand state mutations, and header UI changes that have nothing to do with CI or marketplace status types.

Of the 22 changed files, only 6 are directly related to the CI fix stated in the branch name. The remaining 16 files contain a separate feature (tactical theme) that should have been on its own branch.

**Verdict: NOT ready to merge.** The unrelated feature work and several band-aid fixes need to be resolved.

---

## Critical Issues

### CR-01: Feature work mixed into a CI-fix branch (scope contamination)

**Files:** `src/core/state/uiSlice.ts`, `src/core/state/uiSlice.test.ts`, `src/components/layout/AppShell.tsx`, `src/components/layout/Header.tsx`, `src/components/layout/BottomPanelManager.tsx`, `src/components/panels/DataConfig/index.tsx`, `src/components/panels/LayerPanel.tsx`, `src/styles/theme-tokens.css`, `.agents/rules/context-bloat-protection.md`, `AGENTS.md`

**Issue:** This branch introduces a complete "tactical" visual theme — new Zustand state values, new cycling order, new CSS variables (~50 lines of tokens), new component rendering branches, and new UI icons — alongside CI bug fixes. The "tactical" theme touches 8 source files. The `hud-corners` CSS class is added to three panel components. The `context-bloat-protection.md` and `AGENTS.md` are documentation changes also unrelated to the CI fix.

This violates the principle of atomic commits and makes cherry-picking, reverting, or reviewing either change independently impossible. If the tactical theme has a bug, you cannot roll it back without also reverting CI fixes (and vice versa).

**Fix:** Split the branch into two:
- `fix/ci-marketplace-status-type` — only CI fix changes
- `feat/tactical-theme` — the tactical theme feature

**Severity:** BLOCKER

### CR-02: `safe-db-push.mjs` — hardcoded container name and silent error swallowing

**File:** `scripts/safe-db-push.mjs:21-24`

**Issue:**
```javascript
try {
  execSync('docker exec worldwideview-db-1 psql -U postgres -c "CREATE DATABASE worldwideview_shadow;" 2>/dev/null', { stdio: 'pipe' });
} catch (e) {
  // Database likely already exists
}
```

Three problems:
1. **Hardcoded container name** `worldwideview-db-1` — Docker Compose appends a hash suffix (`worldwideview-db-1` is usually correct, but can vary if the project name is customized or if running in a stack with a different `--project-name`). The image name varies between `postgis/postgis` and `postgres`.
2. **Silent error swallowing** — the `2>/dev/null` inside the command AND the empty `catch` together hide ALL failure modes: container not running, `psql` not installed, wrong password, network error, disk full. A failure to create the shadow database will cause `prisma db push` to fail later with an inscrutable Prisma error instead of a clear script-level message.
3. **Database name assumption** — hardcodes `worldview_shadow` but `prisma.config.ts` uses `deriveShadowUrl` which appends `_shadow` to whatever the database name is. If `DATABASE_URL` uses a different database name, the script creates the wrong shadow database. The script and config are **inconsistent** — the script assumes the db name is `worldwideview` but the config derives it generically.

**Fix:**
```javascript
// scripts/safe-db-push.mjs
// Parse database name from DATABASE_URL instead of hardcoding
const dbUrl = process.env.DATABASE_URL || '';
const dbName = dbUrl.match(/\/([^/?]+)(\?|$)/)?.[1];
if (!dbName) {
  console.error('Could not determine database name from DATABASE_URL');
  process.exit(1);
}
const shadowDbName = `${dbName}_shadow`;

// Detect container from docker-compose
const containerName = process.env.DATABASE_CONTAINER || 'worldwideview-db-1';

try {
  execSync(`docker exec ${containerName} psql -U postgres -c "CREATE DATABASE ${shadowDbName};"`, { stdio: 'pipe' });
  console.log(`Shadow database "${shadowDbName}" ensured.`);
} catch (e) {
  // Check if error is "already exists" or something worse
  const stderr = e.stderr?.toString() || '';
  if (stderr.includes('already exists')) {
    console.log(`Shadow database "${shadowDbName}" already exists.`);
  } else {
    console.error(`Failed to create shadow database: ${stderr}`);
    process.exit(1);
  }
}
```

**Severity:** CRITICAL — data loss risk (silent failures) and wrong container name leads to incorrect shadow DB targeting

---

## Warnings

### WR-01: `prisma.config.ts` — `deriveShadowUrl` regex could produce malformed URLs

**File:** `prisma.config.ts:30`

```typescript
function deriveShadowUrl(url: string | undefined): string | undefined {
    if (!url) return url;
    return url.replace(/\/([^/?]+)(\?|$)/, "/$1_shadow$2");
}
```

**Issue:** The regex assumes there is exactly one path segment between the last `/` and `?` or end-of-string. This works for typical `postgresql://user:pass@host:5432/dbname` but will produce incorrect results if:
- The URL has a trailing slash before params: `postgresql://.../dbname?sslmode=require` — the `?` is captured correctly.
- The URL has no database name: `postgresql://user:pass@host:5432` — regex won't match, shadow URL will be `undefined`.
- The URL has an unusual schema: `postgresql://user:pass@host:5432/dbname?schema=public` — works but `$2` captures `?schema=public`.

**Fix:** Use the `URL` constructor for more robust parsing (or at minimum, regex match + fallback):

```typescript
function deriveShadowUrl(url: string | undefined): string | undefined {
    if (!url) return url;
    try {
        // postgresql://user:pass@host:5432/dbname?params
        const match = url.match(/^(.+\/)([^/?]+)(\?.*)?$/);
        if (!match) return url;
        return `${match[1]}${match[2]}_shadow${match[3] || ''}`;
    } catch {
        return url;
    }
}
```

**Severity:** WARNING — edge case that could silently break shadow database resolution

### WR-02: `scripts/safe-db-push.mjs` — `psql` may not be in the container

**File:** `scripts/safe-db-push.mjs:22`

**Issue:** The script runs `psql -U postgres` inside the Docker container, but:
1. The container may not have `psql` installed (slim/scratch-based images).
2. The PostgreSQL user may not be `postgres` (could be a custom user).
3. No password is provided — if `PGPASSWORD` is not set in the container env, this will fail.

**Fix:** Use `docker exec -e PGPASSWORD=...` with the actual database password, or use `createdb` if available. Alternatively, use `docker exec worldwideview-db-1 psql -U "${DB_USER:-postgres}"` and require the env var to be set.

**Severity:** WARNING

### WR-03: `MarketplaceConnect.tsx` — `isDemo` is a module-level const, not reactive

**File:** `src/components/panels/MarketplaceConnect.tsx:33`

```typescript
const [status, setStatus] = useState<Status>(() =>
    isDemo
        ? { kind: "unavailable", reason: "Not available on demo edition" }
        : { kind: "loading" },
);
```

**Issue:** The `isDemo` check works at module-scope initialization time, but `isDemo` is evaluated from `NEXT_PUBLIC_WWV_EDITION` at module load time. If the edition were ever to change at runtime (SSR hydration mismatch, hot reload), this initializer would be stale. The `useEffect` still checks `if (isDemo) return;` which is good, but the initializer and the effect guard against the same condition — if one is wrong, both are wrong.

This is not a bug per se (the lazy initializer is a valid React pattern), but it creates a code smell where two separate mechanisms guard the same condition. If a future developer removes the `useEffect` guard thinking the initializer handles it, the component will silently skip the fetch without updating status.

**Fix:** This is acceptable as-is for the stated goal (fixing the lint error). The redundant `useEffect` guard should be kept as defense-in-depth with a comment:

```typescript
// Lazy initializer prevents SSR hydration flash.
// The useEffect guard (below) is defense-in-depth for runtime edition changes.
```

**Severity:** WARNING — low likelihood but brittle if edition logic changes

### WR-04: Unrelated tactical theme in CI fix branch

**File:** Multiple (see CR-01)

**Issue:** Beyond the scope issue described in CR-01, there are specific quality concerns with the tactical theme:

1. **`uiSlice.ts:145`** — The theme cycle order changed: `dark -> tactical` instead of `dark -> black`. This means users with the `dark` theme set will get `tactical` on next cycle instead of `black`. This is a behavior change that should be intentional and communicated, not smuggled in a CI fix.

2. **`AppShell.tsx:183`** — The tactical theme adds a CSS class `tactical-scanlines` to the globe container, but the `theme-tokens.css` doesn't define this class. A search or review would confirm if this class exists elsewhere or is expected to exist. If not, it's dead code.

**Fix:** Move to a separate branch. On the tactical branch, ensure `tactical-scanlines` CSS class is defined.

**Severity:** WARNING (the scope contamination itself is BLOCKER)

### WR-05: `package.json` esbuild override — version pin without audit context

**File:** `package.json:115`

```json
"esbuild": ">=0.28.1"
```

**Issue:** The override adds a minimum version floor for esbuild (`>=0.28.1`) but provides no context about:
1. Which CVE or audit warning triggered this
2. Which dependency transitively depends on the vulnerable esbuild version
3. Why 0.28.1 specifically (rather than the latest)
4. Whether there are breaking changes in 0.28.x that could affect consumers

Without this context, future maintainers won't know when it's safe to remove the override.

**Fix:** Add a comment explaining the provenance:
```json
// esbuild >=0.28.1 required by Next.js 16 via @next/swc — CVE-2025-XXXXX
```
Or better, run `pnpm audit` and use `pnpm.onlyBuiltDependencies` or a `.pnpmfile.cjs` hook instead of blanket overrides.

**Severity:** WARNING

### WR-06: `ssrf.ts` — log dedup has unbounded memory growth

**File:** `src/lib/security/ssrf.ts:36`

```typescript
const warnedHosts = new Set<string>();
```

**Issue:** The `warnedHosts` Set grows unboundedly over the lifetime of the server process. If the proxy is in permissive mode (`*`) and sees thousands of unique hostnames, this Set will grow without limit. For a long-running production server, this is a slow memory leak.

**Fix:** Use a bounded cache or TTL-based eviction:
```typescript
// LRU-like bounded set — discard oldest entries after 1000 hosts
const MAX_WARNED_HOSTS = 1000;
function warnHost(hostname: string): void {
    if (warnedHosts.has(hostname)) return;
    if (warnedHosts.size >= MAX_WARNED_HOSTS) {
        const first = warnedHosts.values().next().value;
        warnedHosts.delete(first);
    }
    warnedHosts.add(hostname);
    console.warn(`[SSRF] ...`);
}
```

**Severity:** WARNING — very low severity in practice (permissive mode should be temporary), but technically unbounded growth is a bug

### WR-07: `playwright.config.ts` — reporter tuple format uses `outputFolder` but no outputDir syncing

**File:** `playwright.config.ts:39`

```typescript
reporter: [['html', { outputFolder: 'playwright/report' }]],
```

**Issue:** Playwright 1.60 changed the reporter API from positional args to tuples. The `outputFolder` config for the HTML reporter is correct for Playwright 1.60, but it's not synchronized with the `outputDir` setting (`playwright/output`). The HTML reporter's `outputFolder` is relative to `outputDir` by default, but providing an absolute-like path like `playwright/report` could cause confusion about whether it's relative to the project root or relative to `outputDir`.

**Fix:** Use a path relative to `outputDir`:
```typescript
reporter: [['html', { outputFolder: './report' }]],
// This creates playwright/output/report/ — explicit and predictable
```
Or document the relationship with a comment.

**Severity:** WARNING — confusing but not broken (Playwright resolves this relative to the config file)

---

## Band-Aid Analysis

Each CI-related change evaluated for proper fix vs band-aid:

| Change | Proper Fix? | Verdict |
|---|---|---|
| `status.spec.ts` — added mock fields | **Yes** — the mock must satisfy the full TypeScript type | Proper fix |
| `MarketplaceConnect.tsx` — lazy initializer | **Yes** — eliminates the lint warning properly without changing behavior | Proper fix |
| `prisma.config.ts` — `deriveShadowUrl` | **Almost** — correct approach but regex is fragile (WR-01) | Proper fix with minor issues |
| `safe-db-push.mjs` — shadow DB creation | **No** — hardcoded names, silent error swallowing (CR-02) | **Band-aid** |
| `ticketClient.spec.ts` — error string update | **Yes** — test now matches source | Proper fix |
| `playwright.config.ts` — reporter tuple | **Yes** — correctly follows Playwright 1.60 API | Proper fix |
| `package.json` — esbuild override | **Partial** — pins version but undocumented (WR-05) | Partial band-aid |
| `ssrf.ts` — log dedup | **Almost** — good dedup but unbounded memory (WR-06) | Proper fix with minor issues |

### The Real Band-Aid: `safe-db-push.mjs`

The shadow database creation in `safe-db-push.mjs` is the clearest band-aid. The root cause is:

> **Prisma needs a separate shadow database for `db push` to detect schema drift, but the CI environment only has one database.**

A proper fix would:
1. Parse the database name from `DATABASE_URL` dynamically instead of hardcoding
2. Check whether the shadow DB already exists before attempting creation
3. Surface errors clearly instead of swallowing them
4. Support configurable container names via environment variable
5. Use `createdb` via `docker exec` or a Prisma-native approach

The current implementation works by luck (container name happens to match, database name happens to be `worldwideview`, PostgreSQL auth is passwordless) but will break silently in any non-default configuration.

---

## Info Items

### IN-01: `.gitignore` — duplicate legacy entries left in

**File:** `.gitignore:161-162`

The old paths `/test-results/` and `/playwright-report/` are still in `.gitignore` alongside the new paths. This is harmless but leaves confusion about which paths are active.

### IN-02: Tactical theme test has no cycle-through test

**File:** `src/core/state/uiSlice.test.ts:79`

The test toggles to `tactical` and `black` but doesn't assert the full cycle. This is fragile — if the cycle order changes again, this test may pass by coincidence.

---

## Overall Assessment

| Criterion | Verdict |
|---|---|
| CI fixes correct? | Mostly (6/7 proper fixes, 1 band-aid) |
| Branch scope clean? | **NO** — tactical theme contaminates the branch |
| Tests updated? | Yes — status spec, ticket spec, uiSlice test |
| Silent failures? | **YES** — safe-db-push.mjs swallows errors |
| Ready to merge? | **NO** |

### Action Required Before Merge

1. **Split the branch** — move tactical theme changes to `feat/tactical-theme` (8 source files + tests + CSS + docs)
2. **Fix `safe-db-push.mjs`** — dynamic container name, dynamic database name, proper error handling (CR-02)
3. **Harden `deriveShadowUrl`** regex — handle edge cases (WR-01)
4. **Document esbuild override** provenance in `package.json` (WR-05)
5. **Bound the `warnedHosts` Set** in `ssrf.ts` (WR-06)

The safe-db-push.mjs issue is the most dangerous because it will fail silently in non-default environments, causing `prisma db push` to fail with an unrelated Prisma error during CI deployments.

---

_Reviewed: 2026-06-14T18:00:00Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_

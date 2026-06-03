---
phase: 18-globe-state-sync
plan: "05"
subsystem: api-route-security
tags: [security, demo-gate, gap-closure, rsrc-01]
dependency_graph:
  requires: []
  provides: [isDemo-gate-on-globe-state-post]
  affects: [src/app/api/globe/state/route.ts, src/app/api/globe/state/route.test.ts]
tech_stack:
  added: []
  patterns: [vi.hoisted-mutable-mock, isDemo-gate-before-auth]
key_files:
  created: []
  modified:
    - src/app/api/globe/state/route.ts
    - src/app/api/globe/state/route.test.ts
decisions:
  - "vi.hoisted() required for editionMock because vi.mock factories are hoisted above const declarations"
  - "isDemo gate placed after rate limiter and before userId resolution (matching canonical api-keys pattern)"
  - "useGlobeStateSync requires no code change: fetch only catches thrown exceptions, not HTTP 4xx responses"
metrics:
  duration: "8 minutes"
  completed: "2026-05-30"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 18 Plan 05: isDemo Gate for POST /api/globe/state Summary

**One-liner:** Added isDemo edition gate (403 before auth) to POST /api/globe/state, closing GAP-01 identified in the PR #215 pre-merge audit.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add isDemo gate + test | ee16ec0 | route.ts, route.test.ts |
| 2 | Verify useGlobeStateSync handles 403 gracefully | (no commit - read-only verification) | useGlobeStateSync.ts |

## What Was Built

**GAP-01 closed:** `POST /api/globe/state` previously had no demo-edition gate, allowing demo users to write globe state to Redis. The fix:

1. `route.ts`: Added `import { isDemo } from "@/core/edition"` and an early-return guard immediately after the rate limiter check and before the `userId` resolution block. Returns `{ error: "Not available in demo edition" }` with HTTP 403.

2. `route.test.ts`: Added `editionMock` via `vi.hoisted()` (required because `vi.mock` factories are hoisted above normal `const` declarations), a `vi.mock("@/core/edition", () => editionMock)` call, reset `editionMock.isDemo = false` in the existing `beforeEach`, and a new describe block "POST /api/globe/state -- demo edition gate" with one test asserting 403 + correct body + `writeGlobeState` not called.

**Task 2 - verification only:** `useGlobeStateSync.pushState` wraps `fetch` in a `try/catch` that only catches thrown exceptions (network errors). HTTP 403 responses are awaited and silently discarded because the hook never inspects `response.ok` or `response.status`. No code change was required.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.hoisted() required for editionMock**
- **Found during:** Task 1 (test run)
- **Issue:** The plan suggested `const editionMock = { isDemo: false }` declared at module scope, but Vitest hoists `vi.mock` calls above all `const` declarations. The mock factory referenced `editionMock` before it was initialized, causing `ReferenceError: Cannot access 'editionMock' before initialization`.
- **Fix:** Wrapped the declaration in `vi.hoisted()`: `const editionMock = vi.hoisted(() => ({ isDemo: false }))`. This runs the factory function before hoisting resolves, making the variable available to the `vi.mock` factory.
- **Files modified:** `src/app/api/globe/state/route.test.ts`
- **Commit:** ee16ec0

## Test Results

All 6 tests passed (5 pre-existing + 1 new):

```
POST /api/globe/state (RSRC-01)
  - returns 200 and calls writeGlobeState with valid auth + body
  - returns 401 and does NOT call writeGlobeState when auth returns null
  - returns 400 and does NOT call writeGlobeState when sessionId is missing
  - returns 400 when snapshot is missing from body
  - still yields 200 when writeGlobeState rejects (fire-and-forget contract)
POST /api/globe/state -- demo edition gate
  - returns 403 and does NOT call writeGlobeState when isDemo is true
```

TypeScript strict mode: zero errors (`pnpm tsc --noEmit`).

## Threat Model Coverage

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-18-05-01 | isDemo gate before auth prevents demo users writing state even with a valid session | MITIGATED |
| T-18-05-02 | 403 returned before writeGlobeState is called; no Redis write occurs on demo edition | MITIGATED |

## Known Stubs

None.

## Threat Flags

None - this plan closes a security gap rather than introducing new surface.

## Self-Check: PASSED

- [x] `src/app/api/globe/state/route.ts` modified - `isDemo` import and guard present
- [x] `src/app/api/globe/state/route.test.ts` modified - new describe block present
- [x] Commit ee16ec0 exists in git log
- [x] 6/6 tests green
- [x] tsc --noEmit: zero errors

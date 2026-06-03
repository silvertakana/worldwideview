---
phase: 16-api-key-auth-foundation
plan: "03"
subsystem: api-key-auth
tags: [api-keys, crud-routes, auth, ownership-scoping, reveal-once]
dependency_graph:
  requires: ["16-01", "16-02"]
  provides: ["16-04"]
  affects: []
tech_stack:
  added: []
  patterns:
    - "isDemo gate before session check on all handlers"
    - "deleteMany for atomic ownership-scoped hard delete (BOLA prevention)"
    - "P2002 prefix-collision retry on create"
    - "reveal-once fullToken in 201 body only"
key_files:
  created:
    - src/app/api/api-keys/route.ts
    - src/app/api/api-keys/[id]/route.ts
  modified: []
decisions:
  - "userId always taken from session.user.id, never from request body (T-16-09)"
  - "isDemo gate runs FIRST before auth() in all three handlers (Pitfall 6 - demo has no DB row)"
  - "createKeyWithRetry helper isolates P2002 catch so outer handler catch-all remains clean"
  - "deleteMany (not delete) used to avoid Prisma NotFound throw on foreign key - returns count 0 instead (TOCTOU elimination)"
metrics:
  duration: "~12 minutes"
  completed_date: "2026-05-29"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 16 Plan 03: API Key CRUD Route Handlers Summary

## One-liner

GET/POST/DELETE route handlers for `/api/api-keys` with ownership-scoped revoke, max-3 enforcement, and reveal-once fullToken in the 201 response.

## What Was Built

Three HTTP handlers completing the Wave 2 server surface:

**`src/app/api/api-keys/route.ts`** (GET + POST)
- GET: lists the session user's keys selecting only `{ id, name, prefix, createdAt, lastUsedAt }` - `hashedSecret` never included in response
- POST: enforces max-3 (422 `max_keys_reached`), calls `generateApiKey()`, creates the row via Prisma, handles P2002 prefix collision with a single retry, returns 201 `{ key: { id, name, createdAt, fullToken } }` - fullToken returned exactly once here, never again

**`src/app/api/api-keys/[id]/route.ts`** (DELETE)
- `deleteMany({ where: { id, userId } })` - atomic ownership scoping; a foreign or missing key yields `count 0` -> 404, never a 500 or accidental deletion of another user's key

Both files apply the isDemo gate (403) before `auth()` on every handler, per Pitfall 6 (the demo virtual admin has no DB row).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement GET + POST route.ts | 476befe | src/app/api/api-keys/route.ts |
| 2 | Implement DELETE [id]/route.ts | 4e6ff07 | src/app/api/api-keys/[id]/route.ts |

## Test Results

- `pnpm test -- --run src/app/api/api-keys/route.test.ts`: 6/6 GREEN
- `pnpm test -- --run "src/app/api/api-keys/[id]/route.test.ts"`: 4/4 GREEN
- Full suite `pnpm test -- --run`: 403/403 GREEN (56 test files, no regressions)

## Security Invariants Verified

| Threat ID | Disposition | Verification |
|-----------|-------------|--------------|
| T-16-06 (BOLA - foreign key delete) | mitigated | deleteMany where clause tested in [id]/route.test.ts "ownership enforcement" test |
| T-16-07 (hashedSecret/fullToken in list) | mitigated | "response never contains hashedSecret field" test asserts this; GET select projection omits it |
| T-16-08 (demo gate) | mitigated | isDemo check is first line of all three handlers |
| T-16-09 (userId from body) | mitigated | userId always `session.user.id`, never read from request body |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None - no new network surface beyond the planned routes.

## Self-Check: PASSED

- `src/app/api/api-keys/route.ts` exists: FOUND
- `src/app/api/api-keys/[id]/route.ts` exists: FOUND
- Commit 476befe exists: FOUND
- Commit 4e6ff07 exists: FOUND

---
phase: "22"
plan: "02"
subsystem: "market-tracker seeder (local-seeders/community)"
tags: [providers, factory, market-tracker, typescript, refactor]
dependency_graph:
  requires: [MarketProvider interface, yahooProvider, createFinnhubProvider, createPolygonProvider (all from Plan 01)]
  provides: [activeProvider (runtime-selected MarketProvider), searchTickers stub, refactored src/index.ts]
  affects: [packages/market-tracker/src/index.ts, packages/market-tracker/src/__tests__/seederContract.test.ts]
tech_stack:
  added: []
  patterns: [environment-driven factory selection, provider barrel export, test mock at abstraction boundary]
key_files:
  created:
    - local-seeders/community/packages/market-tracker/src/providers/index.ts
  modified:
    - local-seeders/community/packages/market-tracker/src/index.ts
    - local-seeders/community/packages/market-tracker/src/__tests__/seederContract.test.ts
    - local-seeders/community/packages/market-tracker/src/__tests__/distContract.test.ts
decisions:
  - "resolveProvider() runs once at module load (not per-request) so provider selection cost is O(1)"
  - "MARKET_PROVIDER is trimmed and lowercased to tolerate deployment environment variations (T-22-04 mitigation)"
  - "searchTickers returns [] for both supportsSearch true and false -- gate is the deliverable; live search deferred to ticker search UX phase"
  - "distContract.test.ts retains vi.mock('yahoo-finance2') because the dist bundle keeps yahoo-finance2 as an external (tsup external regex)"
  - "Quote and StockTick are structurally identical so quotes cast directly as StockTick[] with no field mapping needed"
metrics:
  duration: "15 minutes"
  completed: "2026-05-30"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 3
---

# Phase 22 Plan 02: Provider Factory and Test Updates Summary

**One-liner:** Environment-driven provider factory (providers/index.ts) wiring MARKET_PROVIDER to finnhub/polygon/yahoo with fallback warnings, plus src/index.ts refactored to delegate all quote fetching to activeProvider.getQuotes().

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create provider factory (providers/index.ts) | 87b53ec | providers/index.ts |
| 2 | Refactor src/index.ts and update tests | a59f76c | src/index.ts, __tests__/seederContract.test.ts, __tests__/distContract.test.ts |

## What Was Built

### providers/index.ts

Factory that runs once at module load. Reads `MARKET_PROVIDER` from `process.env`, trims and lowercases (T-22-04 mitigation), then:
- `finnhub`: reads `FINNHUB_API_KEY`; if absent, warns and falls back to `yahooProvider`
- `polygon`: reads `POLYGON_API_KEY`; if absent, warns and falls back to `yahooProvider`
- anything else (undefined, `yahoo`, unknown): uses `yahooProvider` silently

Exports `activeProvider: MarketProvider` (the resolved instance) and `searchTickers(_query): Promise<string[]>` (stub returning `[]` in all cases - supportsSearch gate is the Phase 22 deliverable; live search deferred).

Only the provider name is logged at startup - API key values are never written to stdout (T-22-05 mitigation).

### src/index.ts (refactored)

Removed: direct `yahoo-finance2` import, `withRetry` import, `TICKERS` local const, inline quote-fetching logic.

Added: `import { activeProvider } from './providers'`, `import { TICKERS } from './providers/yahoo'`.

`fetchQuotes()` is now pure orchestration: guard on `isMarketOpen()`, delegate to `activeProvider.getQuotes(TICKERS)`, return as `StockTick[]`. The `StockTick` interface stays in place as the public Redis shape. Default export shape `{ name, interval, fetch }` is byte-for-byte identical to pre-refactor.

### seederContract.test.ts

Replaced `vi.mock('yahoo-finance2')` (which was mocking the internal library) with `vi.mock('../providers', () => ({ activeProvider: { getQuotes: vi.fn(async () => []), supportsSearch: false }, searchTickers: vi.fn(async () => []) }))`. Mock is now at the correct abstraction boundary. The three contract assertions (name, interval, fetch type) are unchanged.

### distContract.test.ts

Comment updated to reflect the new architecture. The `vi.mock('yahoo-finance2')` mock is intentionally retained: the dist bundle (built with tsup) marks all non-`@wwv-seeders/*` packages as external, so `yahoo-finance2` remains an external import in `dist/index.mjs` even after the refactor.

## Deviations from Plan

None - plan executed exactly as written.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|-----------|
| T-22-04 | Factory trims and lowercases MARKET_PROVIDER value; unknown values fall through to yahoo silently |
| T-22-05 | Startup log emits only the provider name ('finnhub'/'polygon'/'yahoo (default)'); no API key values written to stdout |

## Known Stubs

- `searchTickers(_query): Promise<string[]>` always returns `[]` regardless of `activeProvider.supportsSearch`. The flag itself is the Phase 22 deliverable; live Finnhub/Polygon search API calls are deferred to the phase where ticker search UX is built.

## Verification Results

All 17 tests pass (3 seeder contract + 3 dist contract + 11 isMarketOpen):

```
Test Files  3 passed (3)
      Tests  17 passed (17)
```

Acceptance criteria verified:
- [x] No `yahoo-finance2` import in `src/index.ts`
- [x] `activeProvider` imported from `./providers` in `src/index.ts`
- [x] `TICKERS` imported from `./providers/yahoo` in `src/index.ts`
- [x] Default export shape `{ name: 'market-tracker', interval: 30_000, fetch: fetchQuotes }` preserved
- [x] `seederContract.test.ts` contains no `vi.mock('yahoo-finance2')`
- [x] `seederContract.test.ts` mocks `../providers` with `activeProvider` stub
- [x] All 17 tests pass

## Self-Check

- [x] providers/index.ts created and exports activeProvider and searchTickers
- [x] src/index.ts has no yahoo-finance2 import
- [x] src/index.ts imports activeProvider from ./providers
- [x] src/index.ts imports TICKERS from ./providers/yahoo
- [x] Redis key 'market-tracker' preserved in name field
- [x] seederContract mock moved to provider boundary
- [x] distContract retains yahoo-finance2 mock (correct for dist externals)
- [x] Commit 87b53ec (providers/index.ts) exists in local-seeders/community
- [x] Commit a59f76c (src/index.ts + tests) exists in local-seeders/community

## Self-Check: PASSED

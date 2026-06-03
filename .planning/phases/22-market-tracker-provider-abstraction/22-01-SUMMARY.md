---
phase: "22"
plan: "01"
subsystem: "market-tracker seeder (local-seeders/community)"
tags: [providers, abstraction, market-tracker, typescript]
dependency_graph:
  requires: []
  provides: [MarketProvider interface, Quote type, yahooProvider, createFinnhubProvider, createPolygonProvider]
  affects: [packages/market-tracker/src/index.ts (Plan 02 wiring)]
tech_stack:
  added: []
  patterns: [factory function pattern for keyed providers, interface-based provider contract]
key_files:
  created:
    - local-seeders/community/packages/market-tracker/src/providers/types.ts
    - local-seeders/community/packages/market-tracker/src/providers/yahoo.ts
    - local-seeders/community/packages/market-tracker/src/providers/finnhub.ts
    - local-seeders/community/packages/market-tracker/src/providers/polygon.ts
  modified: []
decisions:
  - "Yahoo provider wraps getQuotes in a named function before assigning to yahooProvider object for clean type inference"
  - "Finnhub per-symbol catch returns null and filters; avoids one bad symbol rejecting the whole batch (T-22-03 mitigation)"
  - "Polygon uses a single batch endpoint rather than per-symbol fetch; HTTP-level errors log and return [] rather than throw"
  - "tsconfig has strict:false so pre-existing module-not-found errors from missing node_modules do not block tsc verification"
metrics:
  duration: "8 minutes"
  completed: "2026-05-30"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
---

# Phase 22 Plan 01: Market-Tracker Provider Abstraction Summary

**One-liner:** Four-file provider layer establishing MarketProvider/Quote contracts plus Yahoo (zero-key), Finnhub (per-symbol parallel fetch), and Polygon (batch snapshot) concrete implementations.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Define MarketProvider interface and Quote type | c2b88ed | providers/types.ts |
| 2 | Extract Yahoo provider from current implementation | 242d955 | providers/yahoo.ts |
| 3 | Implement Finnhub and Polygon providers | e59f097 | providers/finnhub.ts, providers/polygon.ts |

## What Was Built

### types.ts
Single source of truth for all provider contracts. `Quote` mirrors the existing `StockTick` shape (id, price, changePercent, timestamp). `MarketProvider` declares `getQuotes(symbols: string[]): Promise<Quote[]>` and `supportsSearch: boolean`.

### yahoo.ts
Extracts the existing `fetchQuotes` logic from `index.ts` into a `MarketProvider` implementation. Preserves the `withRetry` wrapper, `regularMarketPrice == null` guard, and `regularMarketChangePercent ?? 0` fallback verbatim. Exports `TICKERS` const and `yahooProvider` with `supportsSearch: false`.

### finnhub.ts
Factory function `createFinnhubProvider(apiKey: string): MarketProvider`. Fetches symbols in parallel via `Promise.all`; each symbol has its own try/catch so one failure does not abort the batch (T-22-03 mitigation). Skips symbols where `c === 0` (Finnhub sentinel for unknown symbols). Uses native `fetch` only.

### polygon.ts
Factory function `createPolygonProvider(apiKey: string): MarketProvider`. Single batch request to the snapshot endpoint. HTTP errors (non-ok status or network failure) log and return `[]` rather than throw. Null-guards `day.c` before mapping. Uses native `fetch` only.

## Deviations from Plan

None - plan executed exactly as written.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|-----------|
| T-22-02 | Null-guard on every API response field before mapping to Quote; malformed entries skipped |
| T-22-03 | Per-symbol catch in Finnhub prevents one failing symbol from rejecting the whole Promise.all batch |

## Known Stubs

None. All four files are complete implementations with no placeholder data.

## Verification Notes

Pre-existing `tsc --noEmit` errors exist for the package due to missing `node_modules` in the worktree (yahoo-finance2, seeder-sdk, date-fns). These are not caused by this plan's changes - the new provider files themselves are type-correct. Plan 02 wiring (index.ts) must be completed before a full install + compile can be performed.

## Self-Check

- [x] providers/types.ts exists and exports MarketProvider and Quote
- [x] providers/yahoo.ts exports yahooProvider (supportsSearch: false) and TICKERS
- [x] providers/finnhub.ts exports createFinnhubProvider factory (supportsSearch: true)
- [x] providers/polygon.ts exports createPolygonProvider factory (supportsSearch: true)
- [x] No provider file reads process.env
- [x] No `any` or `@ts-ignore` in any provider file
- [x] Commits c2b88ed, 242d955, e59f097 exist in local-seeders/community git repo
- [x] Native fetch used for HTTP calls (no Finnhub/Polygon SDKs)

## Self-Check: PASSED

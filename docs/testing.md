<!-- Generated: 2026-04-23 06:11:00 UTC -->
# Testing

## Overview
WorldWideView utilizes Vitest alongside a `jsdom` environment and the React Testing Library to ensure high reliability across core application logic, server APIs, and plugin loaders. Test coverage is strategically focused on shared libraries, core state logic, and the plugin ecosystem mechanisms.

## Test Types

### Unit Tests
Focused on validating standalone functions and state slice reducers without mounting React components.
- **Example:** Validating the runtime edition feature flags.
  - *File:* `src/core/edition.test.ts`
- **Example:** Validating marketplace token exchanges and rate limiting logic.
  - *Files:* `src/lib/marketplaceToken.test.ts`, `src/lib/rateLimit.test.ts`

### Integration Tests
Focused on ensuring module interaction, such as the event bus properly interacting with state, or plugin loaders successfully resolving manifests.
- **Example:** Testing local database repositories.
  - *File:* `src/lib/repository.test.ts`
- **Example:** Validating cross-origin resource sharing (CORS) handlers for data engine streaming.
  - *File:* `src/lib/cors.test.ts`
- **Example:** Verifying demo-admin bypass secrets.
  - *File:* `src/lib/demoAdmin.test.ts`

## Running Tests

Execute the following commands from the root `worldwideview` directory:

- **Run all tests once:**
  ```bash
  pnpm test
  ```
  *(Alias for `vitest run`)*

- **Run tests in watch mode (for active development):**
  ```bash
  npx vitest
  ```

## Reference
- **Coverage Scope:** The Vitest configuration targets tests located inside `src/lib/**`, `src/core/**`, `src/plugins/**`, `src/app/**`, and `packages/**`.
- **Environment:** The test environment is configured as `jsdom` via `vite.config.ts` or `vitest.config.ts`, ensuring that DOM-specific API calls function outside of a real browser.

## Patterns

### Plain function — no mocks needed
Pull in the function, call it with representative inputs, assert the output. See `src/lib/marketplace/cors.test.ts` or `src/app/api/camera/adapters/registry.test.ts` for examples.

### Stateful singleton — reset in `afterEach`
Most of the data layer (`dataBus`, `cacheLayer`, `pollingManager`) is exported as a singleton instance. Tests pass when run alone but fail when run together if state leaks. `DataBus.test.ts` shows the canonical cleanup:

```typescript
import { dataBus } from "./DataBus";

afterEach(() => {
    dataBus.removeAllListeners();
});
```

### Module-level dependency — mock with `vi.mock`
When the module under test pulls in something heavy (the store, the database, Cesium), mock that module before the import. `vi.mock` calls are hoisted, so they take effect even when written below the import in source order. See `src/lib/marketplace/repository.test.ts` (Prisma client) or `src/core/data/PollingManager.test.ts` (Zustand store).

### Timers — fake them per test
`vi.useFakeTimers()` in `beforeEach`, `vi.useRealTimers()` in `afterEach`. Advance time explicitly with `vi.advanceTimersByTimeAsync(ms)`.

> [!CAUTION]
> `vi.runOnlyPendingTimersAsync()` ticks `setInterval`s scheduled on the same tick as the call. For tests where a function runs once synchronously and then schedules a recurring interval, this double-counts the first call. To drain microtasks without advancing the clock, use `await Promise.resolve()` a few times — see `PollingManager.test.ts` for the `flushMicrotasks()` helper.

## What NOT to Test (Yet)

- **Cesium-heavy components.** Anything that mounts a `<Viewer>` or renders entities to the globe needs WebGL, which jsdom doesn't provide. These belong in Playwright-style E2E tests rather than unit tests.
- **Live database round-trips.** Mock the Prisma client at the module boundary — `repository.test.ts` is the reference pattern. Spinning up a real Postgres in CI is expensive and unreliable.
- **Dynamic-import plugin bundles.** The loader uses `import(/* webpackIgnore: true */ entry)` at runtime against a real URL. Test the loader's pre-import logic with a fake module object, not a real dynamic import.

## Philosophy

A small focused suite is more valuable than a large one that's expensive to maintain. Each test should answer: *what specific regression does this catch that I'd otherwise discover from a user bug report?*

Two practical rules:

1. **Prefer testing pure logic over orchestration.** If a function takes inputs and returns outputs, test it directly. If it coordinates a half-dozen other things (the globe, the store, Cesium primitives), either refactor the pure parts out or use an integration test.
2. **Add a test when you fix a bug.** A one-line test that fails today and passes after the fix is enough to prevent the bug from coming back. Land the test in the same PR as the fix.

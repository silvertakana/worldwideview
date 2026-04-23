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
- **Coverage Scope:** The Vitest configuration primarily targets tests located inside `src/lib/**`, `src/core/**`, and `src/plugins/**`.
- **Environment:** The test environment is configured as `jsdom` via `vite.config.ts` or `vitest.config.ts`, ensuring that DOM-specific API calls function outside of a real browser.

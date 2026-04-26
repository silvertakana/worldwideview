<!-- Generated: 2026-04-19 15:23:00 UTC -->
# Testing

WorldWideView maintains a robust Vitest testing infrastructure utilizing `jsdom` environments to mock browser globals and React Testing Library utilities for accurate integration flow testing.

The primary requirement is full test coverage over authentication routes, edge-case platform parsing, and API rate-limit security.

## Test Types
- **Unit Logic:** Verifies math, utilities, and configuration mappings (e.g. `edition.test.ts`).
- **Middleware Integration:** Evaluates Request/Response blocks (e.g. `rateLimit.test.ts`).
- **Component Mocking:** Exercises the React ecosystem state behaviors (e.g. `DeclarativePlugin.test.ts`).

## Key Files
- `vitest.config.ts` (lines 5-25): Defines the inclusion criteria spanning `src/lib/**`, `src/core/**`, and `src/plugins/**`.
- `src/lib/rateLimit.test.ts` (lines 15-60): Demonstrates test encapsulation regarding the Upstash Redis fallbacks.
- `src/core/edition.test.ts` (lines 10-30): Confirms valid feature flag evaluations across local/demo builds.

## Running Tests
Run tests natively within the root directory utilizing `pnpm`:
```bash
# Execute standard test suite runs over all watched directories
pnpm test
# OR
vitest run
```

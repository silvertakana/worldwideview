<!-- Generated: 2026-04-19 02:20:00 UTC -->
# WorldWideView - Testing

## Overview
WWV relies on `Vitest` with a `jsdom` testing environment to mock frontend primitives. Testing primarily covers isolated core modules and strict typescript typings rather than E2E Cesium testing to minimize pipeline fragility.

## Test Types
- **SDK Typing Asserts**: Ensuring plugin schemas validate against the zod structure perfectly (`PluginManifest.ts`).
- **Core Library Services**: Testing ratelimiting, backend marketplace sync APIs, and authentication flows.
- **Component Behaviors**: Testing UI slice changes in Zustand independently of UI components.
- **Plugin Registries**: Verifying trust verification logic inside `PluginManager.ts`.

## Running Tests
Run all tests efficiently using Vitest:
```bash
pnpm test
```

## Reference
- Test execution script maps to standard: `vitest run`
- Core tests are scoped inside isolated plugin files (e.g., `packages/wwv-plugin-sdk/src/*.test.ts`) and `src/lib/*.test.ts`.
- Important test: `src/lib/rateLimit.test.ts` (API route protection).

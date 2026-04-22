<!-- Generated: 2026-04-19 15:23:00 UTC -->
# Build System

WorldWideView operates using a strict `pnpm` monorepo workspace to manage the core Next.js application alongside its surrounding plugin ecosystem.

The build relies heavily on Next.js standalone output tracing optimization, allowing minimal-footprint Docker images via Multi-stage resolution.

## Key Files
- `pnpm-workspace.yaml`: Governs the inclusion of `packages/*` elements.
- `next.config.ts` (lines 10-45): Implements `output: "standalone"` and strict Content-Security-Policy headers.
- `Dockerfile` (lines 1-110): Executes the multi-stage Extractor Pattern (`deps` → `builder` → `runner`).

## Build Workflows
- **Dependency Install:** `pnpm install` must be run from the root directory to respect strict workspace hoisting natively.
- **Development Proxy:** `pnpm dev` triggers the frontend server locally with active HMR, while executing pre-build scripts like `copy-cesium.mjs`.
- **Plugin Compilation:** Run `pnpm -r build` inside `packages/worldwideview-plugins/` to trigger Vite bundle execution mapped to `dist/frontend.mjs`.

## Platform Setup
- **Cesium Resources:** Required assets (Workers, Assets, Widgets) are structurally bound into the `public/cesium/` folder during the pre-build pipeline initialized by `scripts/copy-cesium.mjs` (lines 10-38).
- **SQLite Engine:** `prisma.config.ts` must export native javascript objects (free of dev CLI wrappers) for Next.js to trace correctly in the final standalone Node build.

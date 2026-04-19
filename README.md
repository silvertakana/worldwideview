<!-- Generated: 2026-04-19 02:20:00 UTC -->
# WorldWideView 🌍

**The Open-Source, Plugin-Driven Geospatial Intelligence Engine**

WorldWideView is a real-time geospatial engine visualizing live global data on an interactive 3D globe. Utilizing a dynamic "All-Bundle" plugin architecture, independent data sources—like live aircraft, satellites, or OSINT news clusters—are ingested and rendered decoupled from the core 3D viewer.

## Key Entry Points
- UI Loader: `src/components/layout/AppShell.tsx` 
- Dynamic Plugin Ingestion: `src/core/plugins/loadPluginFromManifest.ts`
- Global WebSocket Event Loop: `src/core/data/DataBus.ts`
- Environment Config: `.env.local` alongside `src/core/edition.ts`

## Quick Build & Execute
```bash
pnpm install
pnpm run setup
pnpm dev:all # boots the UI, cache layers, and the marketplace engine
```

## Plugin Development Quick Start
You can build your own WorldWideView plugins without cloning the main repository using the officially supported CLI toolchain.

```bash
# 1. Scaffold a new WWV plugin anywhere on your machine
npx @worldwideview/create-plugin my-custom-layer

# 2. Navigate into your new plugin directory
cd my-custom-layer
npm install

# 3. Stream your local plugin directly into a running WorldWideView instance!
npm run link ../worldwideview

# 4. Check that your configuration is completely valid before publishing
npm run validate
```

## LLM Documentation Indexes
- **[Architecture (architecture.md)](docs/architecture.md)**: Explore the separation of 3D globe primitives from unified DataBus flows.
- **[Build System (build-system.md)](docs/build-system.md)**: Find compile targets for UI bundles and internal `wwvStaticCompiler` plugin bundling.
- **[Testing Overview (testing.md)](docs/testing.md)**: Understanding Vitest strategies and isolated typing execution targets.
- **[Development Patterns (development.md)](docs/development.md)**: View standard hook approaches, Zustand architecture rules, and snippet targets.
- **[Deployment Workflows (deployment.md)](docs/deployment.md)**: Detailed insights on Next.js standalone execution and persistent database volume arrays.
- **[Source File Catalog (files.md)](docs/files.md)**: High-level mappings of core ingestion controllers to rendering context interfaces.

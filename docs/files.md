<!-- Generated: 2026-04-19 02:20:00 UTC -->
# WorldWideView - Files Catalog

## Overview
The codebase separates Next.js UI routing from highly complex custom engine modules. The primary domain is completely driven by an extensive, plug-and-play ES Module ingestion platform.

## Core Source Files
- [src/core/plugins/PluginManager.ts](../src/core/plugins/PluginManager.ts): Handles runtime tracking of plugins and lifecycle states (enabled/disabled).
- [src/core/plugins/loadPluginFromManifest.ts](../src/core/plugins/loadPluginFromManifest.ts): Orchestrates the dynamic bundle importing (All-Bundle format engine loader).
- [src/core/data/DataBus.ts](../src/core/data/DataBus.ts): Manages all data ingestion distribution.
- [src/core/globe/GlobeView.tsx](../src/core/globe/GlobeView.tsx): Cesium Resium primary mount component handling camera and context.
- [src/core/globe/EntityRenderer.tsx](../src/core/globe/EntityRenderer.tsx): Handles rendering Point/Billboard instances efficiently to the Cesium context.

## Build System & Internal Monorepo Packages
- [packages/wwv-plugin-sdk/src/manifest.ts](../packages/wwv-plugin-sdk/src/manifest.ts): Core metadata interface.
- [next.config.ts](../next.config.ts): Handles CSP, module transpilation, and redirects.
- [scripts/copy-cesium.mjs](../scripts/copy-cesium.mjs): Static asset distributor needed for local execution.

## Configuration
- [prisma/schema.prisma](../prisma/schema.prisma): SQLite database mappings tracking locally registered plugins and settings.
- [.agents/rules](../.agents/rules): Domain-centric constraints guiding LLM operation inside this repo.

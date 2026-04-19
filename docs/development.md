<!-- Generated: 2026-04-19 02:20:00 UTC -->
# WorldWideView - Development Environment

## Overview
Active repository development centers around a pnpm workspaces monorepo containing a Next.js application interacting heavily with internal plugin directories.

## Code Style
- **TypeScript First**: Strict mode forced globally.
- **Vanilla CSS**: Absolutely no tailwind. Native CSS Modules `[name].module.css` or global variables only.
- **File Limits**: Modules should be constrained to 150 lines. Components should be decomposed recursively past this point.

## Common Patterns

### Unified Data Ingest (DataBus)
Avoid manual React fetch intervals. Instead rely on the pub/sub singleton:
```typescript
// See: src/core/data/DataBus.ts 
DataBus.getInstance().emit('dataUpdated', { 
    pluginId: "myplugin", 
    entities: [] 
});
```

### Zustand Slices
Global application state is segregated by explicit context domains.
```typescript
// From src/core/state/layersSlice.ts
export const createLayersSlice: StateCreator<LayersSlice> = (set) => ({
    activeLayers: [],
    toggleLayer: (id) => set(...)
})
```

## Workflows
1. Run `pnpm dev:all` when needing the UI and backend seeder modules to parallel execute.
2. **Creating Plugins**: Use the standalone CLI `npx @worldwideview/create-plugin <name>` to scaffold new plugins without cloning the main repository.
3. **Linking Plugins**: Run `npm run link ../worldwideview` (which calls `wwv link`) inside your plugin to stream live Vite output into the engine development server.
4. **Validating Plugins**: Run `npm run validate` (which calls `wwv validate`) to ensure your `package.json` manifest strictly follows WorldWideView rules before publishing.

## Reference
- **All-Bundle Registry Manager**: `src/core/plugins/PluginManager.ts`
- **Auth Provider**: `src/lib/auth.ts`
- **Main App Shell**: `src/components/layout/AppShell.tsx`

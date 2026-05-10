---
trigger: model_decision
description: The standard operating procedure for instantiating, modifying, and registering a new data source plugin within the engine.
---

# Plugin Architecture & Data Flow

## Purpose
The standard operating procedure for instantiating, modifying, and registering a new data source plugin within the engine.

## The WorldPlugin Contract

All data ingest flows through `WorldPlugin` (defined entirely within `@worldwideview/wwv-plugin-sdk`).
A valid plugin class MUST provide:
1. `id` and `version` (The `version` MUST be dynamically imported via `import pkg from "../package.json"` to prevent duplicate tracking during CI/releases for built-in plugins).
2. `fetch(timeRange)` method logic.
3. `renderEntity(GeoEntity)` to determine visual style.
4. `getPollingInterval()` (defaults fallback securely to standard store config).

## Plugin Architectures (Manifest Formats)

Plugins are defined via `PluginManifest` and operate on an **All-Bundle** architecture.
All frontend extensions must eventually be compiled into a JS bundle that exports a `WorldPlugin`.

1. **`bundle` (Dynamic CDN Loaded / Internal)**: Plugins dynamically imported at runtime via ES module references (e.g., `unpkg.com` or local `/plugins/myplugin/frontend.mjs`). Handled by `loadPluginFromManifest` referencing `manifest.entry`.
2. **`static` (Legacy)**: Now compiled via `wwvStaticCompiler` into a dynamic bundle. The raw `StaticDataPlugin` runtime class has been removed.
3. **`declarative` (Legacy)**: Now compiled or wrapped into bundles.

No matter the source, the engine evaluates it by directly loading the `entry` file dynamically:
`const module = await import(/* webpackIgnore: true */ entry);`

## Package Metadata (`package.json`)

All plugins MUST define their identity and compatibility via a `"worldwideview"` block in their `package.json`. This acts as the source-of-truth for generating the `PluginManifest` for the registry. If a plugin does not define `"type"`, validation functions will reject the manifest entirely or rely on legacy fallbacks.

```json
{
  "name": "@worldwideview/wwv-plugin-myplugin",
  "version": "1.0.0",
  "worldwideview": {
    "id": "myplugin",                      // REQUIRED: Must match the directory name & API routes.
    "type": "data-layer",                  // REQUIRED: "data-layer" or "extension"
    "format": "bundle",                    // REQUIRED: "bundle", "declarative", or "static"
    "category": "Aviation",                // REQUIRED: Matches PluginCategory union in SDK
    "icon": "Plane",                       // RECOMMENDED: Lucide icon name
    "capabilities": [                      // REQUIRED: What the plugin can do
      "data:own",                          // (e.g. injects its own data)
      "globe:overlay",                     // (e.g. renders 3D elements)
      "network:fetch"
    ]
  }
}
```

## The Registration Pipeline

> [!NOTE]
> All plugin interactions run through three singleton services:
> `PluginRegistry` / `InstalledPluginsLoader` -> `PluginManager` -> `PollingManager` -> `DataBus`

### `InstalledPluginsLoader`
Scans the PostgreSQL database at startup for dynamically installed marketplace manifests. Parses, validates (`validateManifest`), and registers valid plugins via `pluginManager.loadFromManifest`.

### `PluginManager`
The orchestrator. Exposes `registerPlugin`, `enablePlugin`, `disablePlugin`. Never bypass the manager to push data manually to the cache. Supports dynamic loading via `loadFromManifest`.

### `PollingManager`
Coordinates interval execution. Implements **exponential backoff**. When a plugin errors, it retries at increasing scales (e.g., 2s → 4s → 8s) automatically. 

### `DataBus`
The typed generic event bus separating React UI components from background execution. 

```typescript
// How data gets pushed onto the rendering surface securely:
DataBus.getInstance().emit('dataUpdated', { 
    pluginId: "mytracker", 
    entities: newEntities 
});
```

## When to Apply
When writing `fetch` implementations for plugins, or tracing why an entity dropped off the map. Ensure missing data correctly triggers the cache fallback via the DataBus. Ensure all new external plugins use the `bundle` format and exist in the marketplace registry to avoid CDN 404 hydrating crashes.


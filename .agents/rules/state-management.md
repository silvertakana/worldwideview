---
trigger: glob
description: Guidelines on managing the single source of truth across WorldWideView using Zustand, avoiding prop-drilling, and isolating UI rerenders.
globs: "src/core/state/**/*, src/components/**/*"
---

# Zustand State Management

## Purpose
Guidelines on managing the single source of truth across WorldWideView using Zustand, avoiding prop-drilling, and isolating UI rerenders.

## Single Centralized State
WorldWideView utilizes a monolithic Zustand store located at `src/core/state/store.ts`. It is broken down into exactly 9 semantic slices.

| Slice Name | Purpose | Example State |
|---|---|---|
| **Globe** | Cesium Viewer state | `cameraPosition`, `selectedEntity` |
| **Layers** | Loaded map tiles/overlays | `activeTileSets` | 
| **Timeline** | Application current time | `currentTimeRange` |
| **UI** | Global overlay states | `isFilterMenuOpen` |
| **Filters** | Active visual filtration | `searchQuery`, `categoryFilter` |
| **Data** | Entity registry | `entitiesByPlugin` |
| **Config** | User preferences | `pollingIntervals`, `pluginSettings` |
| **Favorites**| Pinned entities | `favoriteIds` |
| **GeoJSON** | Local files loaded in | `localImports` |

## When to Apply
When passing deep state across components, or when a plugin must push state configurations onto the screen.

## Best Practices

### Avoid Prop Drilling
**Never** pass props further than two levels down. If a component deeper in the tree needs access to something (e.g., `cameraPosition`), it must `useStore(s => s.globe.cameraPosition)`.

### Selector Destructuring Avoidance
> [!WARNING]
> Do not destructure wide objects in selectors. 
> Right: `const isHUD = useStore(state => state.ui.hudVisible);`
> Wrong: `const { hudVisible } = useStore(state => state.ui);`
> The wrong approach rerenders the component any time *anything* in the `ui` slice changes.

### Config and Plugins
If your plugin has user-configurable values (e.g., color settings, toggle states), its data MUST live inside `state.config.dataConfig.pluginSettings[pluginId]`. Do not spawn un-bound `useState` hooks for UI properties if they affect the global app state.

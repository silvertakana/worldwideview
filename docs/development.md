<!-- Generated: 2026-04-23 06:11:00 UTC -->
# Development

## Overview
Development on WorldWideView prioritizes modularity, high performance, and strict architectural boundaries between the UI and the 3D rendering context. We adhere to rigorous file size constraints and rely heavily on Vanilla CSS and Zustand slice-patterns to maintain clarity across the large ecosystem.

## Code Style

### File Size Limits
- **Max 150 lines per file.** If a component or function grows beyond this, you must modularize it. Extract helper functions, split React components, and utilize custom hooks.

### Styling Conventions
- **Vanilla CSS Only:** Do not use Tailwind CSS or CSS-in-JS. 
- **Global Styles:** Located at `src/app/globals.css`.
- **Component Styles:** Use CSS Modules (`.module.css`) or co-locate `.css` files directly next to their components.
- **HUD Animations:** Specialized interface animations are stored in `src/styles/hud-animations.css`.

### Import Aliases
- Application core: `@/*` → `./src/*`
- Plugin SDK: `@worldwideview/wwv-plugin-sdk` → `./packages/wwv-plugin-sdk/src`
- Custom plugins use their respective names configured in `tsconfig.json`.

## Common Patterns

### Entity Rendering
When translating raw plugin data into `CesiumEntityOptions` inside `renderEntity()`, follow these strict graphical rules:
```typescript
// Correct Point Pattern
renderEntity(entity: GeoEntity): CesiumEntityOptions {
  return {
    type: "point",
    color: "#ff0000",
    size: 10,
    outlineColor: "#ffffff",
    outlineWidth: 2
  };
}

// Correct Billboard Pattern
renderEntity(entity: GeoEntity): CesiumEntityOptions {
  return {
    type: "billboard",
    color: "#ffffff",
    iconUrl: "/icons/aircraft.png",
    iconScale: 0.5
  };
}
```
> [!WARNING]
> **NEVER MIX PROPERTIES:** Do not apply `size`, `outlineWidth`, or `outlineColor` to a `billboard` entity. Mixing these parameters causes severe GPU clipping and rendering artifacts in Cesium.

### State Access
Zustand is divided into slices. For performance, components must select exactly the properties they need to avoid over-rendering:
```typescript
// From src/components/panels/LayerPanel.tsx
const activeLayers = useStore((state) => state.layers.active);
const toggleLayer = useStore((state) => state.layers.toggle);
```

## Workflows

### Debugging & Temporary Scripts
Whenever generating temporary debugging scripts, testing REST endpoints via `.mjs`, or dumping traces/JSON outputs, **save these exclusively inside `/local-scripts/`**. 
- *Reference:* The root directory is strictly for production configuration files.

### Scaffold a New Component
1. Create a new directory under `src/components/{category}/MyComponent`.
2. Add `MyComponent.tsx` and `MyComponent.module.css`.
3. Export from a local `index.ts` if creating a composite view.

## Reference
- **Core Abstractions:** See `packages/wwv-plugin-sdk/src/PluginTypes.ts` for interface expectations.
- **State Slices:** Located in `src/core/state/` (e.g., `globeSlice.ts`, `dataSlice.ts`).

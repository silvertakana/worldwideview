---
trigger: glob
description: Strict guidelines for rendering geospatial entities, handling 3D terrain clipping, and applying dynamic animation properties against Cesium's runtime engine.
globs: "src/core/globe/**/*"
---

# Cesium Rendering Rules

## Purpose
Strict guidelines for rendering geospatial entities, handling 3D terrain clipping, and applying dynamic animation properties against Cesium's runtime engine.

## When to Apply
Whenever writing code for plugins, visual layers, or modifying components like `EntityRenderer` or `GlobeView`.

## Critical Limitations

### `HeightReference.CLAMP_TO_GROUND` Warning
> [!WARNING]
> Do **not** apply `HeightReference.CLAMP_TO_GROUND` to label text rendering (`LabelGraphics`). Due to a known issue in Cesium 1.121+, clamping tens of thousands of dynamic labels blocks the UI thread continuously because Cesium recalculates the terrain intersection each frame.

### Primitive Restrictions
When creating primitive objects:
- **Points** (`PointPrimitive`): Can use `size`, `outlineWidth`, and `outlineColor`.
- **Billboards** (`BillboardGraphics` for SVG/Icons): Must **NOT** use `size`, `outlineWidth`, or `outlineColor`. You must use `iconScale` to resize them. Mixing point properties on billboards causes severe shader clipping.

## Sizing Conventions

| Entity type | Knob         | Default                            | Typical band     | Source |
|-------------|--------------|------------------------------------|------------------|--------|
| `point`     | `size`       | `8` desktop / `12` mobile          | 5–12             | `src/core/globe/primitiveOps.ts` (`defaultPointSize`) |
| `billboard` | `iconScale`  | `0.7` (`DEFAULT_BILLBOARD_SCALE`)  | 0.6–0.9          | `src/core/globe/primitiveOps.ts` (`DEFAULT_BILLBOARD_SCALE`) |
| `model`     | `modelScale` | `1.0` + `modelMinPixelSize`        | varies per asset | `src/core/globe/ModelManager.ts`, `src/core/globe/hooks/useModelRendering.ts` |

> [!IMPORTANT]
> **Cross-plugin parity rule.** If your plugin renders alongside maritime / aviation / military-aviation on the globe, **leave `iconScale` unset** (or pick a value inside 0.6–0.9). A value below 0.5 will look visibly broken next to peer plugins. A value above 1.0 will dominate the globe.

> [!CAUTION]
> **Silent-ignore footgun.** `size` is a `PointPrimitive` property. If you set `size` on a `billboard` entity it is **silently dropped** — Cesium does not error and the billboard simply renders at `DEFAULT_BILLBOARD_SCALE`. When converting a point plugin to a billboard plugin, replace `size: N` with `iconScale: ~N/16` (the canvas base is `getBaseSize() = 48px` desktop) — do not delete it and do not translate it literally as `iconScale: N/10`. This footgun has shipped at least once (see commit history on `local-plugins/wwv-plugin-satellite`).

> [!NOTE]
> **Backdrop stack.** `createSvgIconUrl` (in the SDK) already wraps the icon in a 44×44 SVG with a dark backdrop circle. `src/core/globe/iconUpscaler.ts` then redraws onto a 48px canvas with **another** backdrop circle (`DEFAULT_BG = "rgba(15, 23, 42, 0.55)"`). Pass `background: false` to `createSvgIconUrl` when you want only the host's circle. Don't add a third backdrop in your own SVG.

## Performance Culling

> [!TIP]
> Do not rely solely on depth buffering (`disableDepthTestDistance`) when viewing the backside of the globe. Use CPU-side calculating (dot-product against the Earth's radius) to implement manual horizon culling. Render nothing if the scalar projection is behind the tangential threshold.

## LOD & Stacking
1. Convert distant entities to `billboard` representations.
2. If closely grouped, the `StackManager` should spiderify components circularly. Non-hub objects fade to 0.4 opacity when expanded to reduce visual clutter.
3. Use the `useModelRendering` hook exclusively for transitioning high-importance entities (like aircraft or ships) into full 3D GLTF models on approach.

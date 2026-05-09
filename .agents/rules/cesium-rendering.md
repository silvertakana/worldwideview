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

## Performance Culling

> [!TIP]
> Do not rely solely on depth buffering (`disableDepthTestDistance`) when viewing the backside of the globe. Use CPU-side calculating (dot-product against the Earth's radius) to implement manual horizon culling. Render nothing if the scalar projection is behind the tangential threshold.

## LOD & Stacking
1. Convert distant entities to `billboard` representations.
2. If closely grouped, the `StackManager` should spiderify components circularly. Non-hub objects fade to 0.4 opacity when expanded to reduce visual clutter.
3. Use the `useModelRendering` hook exclusively for transitioning high-importance entities (like aircraft or ships) into full 3D GLTF models on approach.

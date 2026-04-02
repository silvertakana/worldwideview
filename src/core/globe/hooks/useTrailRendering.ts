import { useEffect } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import { Cartesian3, Color, Ellipsoid, Material } from "cesium";
import type { AnimatableItem } from "../EntityRenderer";
import { getCollections } from "../EntityRenderer";

export function useTrailRendering(
    viewer: CesiumViewer | null,
    isReady: boolean,
    animatablesMapRef: React.MutableRefObject<Map<string, AnimatableItem>>
) {
    useEffect(() => {
        if (!viewer || !isReady || viewer.isDestroyed()) return;

        const updateTrails = () => {
            if (viewer.isDestroyed()) return;
            const collections = getCollections(viewer);
            const polylines = collections.polylines;
            if (!polylines) return;

            // Manage additions and removals
            for (const item of animatablesMapRef.current.values()) {
                const history = item.entity.properties.history as any[];
                let trailOpts = item.options.trailOptions;
                
                if (history && history.length > 0 && trailOpts) {
                    if (!item.trailPositions) {
                        try {
                            item.trailPositions = history.map(point => 
                                Cartesian3.fromDegrees(
                                    point.lon || point.longitude || 0, 
                                    point.lat || point.latitude || 0, 
                                    item.entity.altitude || 0, 
                                    Ellipsoid.WGS84
                                )
                            );
                            item.trailPositions.push(Cartesian3.clone(item.posRef));
                        } catch (e) {
                            console.warn("[useTrailRendering] Invalid history formatting", e);
                            continue;
                        }
                    }

                    if (!item.polylinePrimitive) {
                        const colorStr = trailOpts.color || item.options.color || "#0ef";
                        const baseColor = Color.fromCssColorString(colorStr);
                        
                        let material;
                        if (trailOpts.dashPattern === "dashed") {
                            material = Material.fromType("PolylineDash", { color: baseColor });
                        } else if (trailOpts.opacityFade) {
                            material = Material.fromType("PolylineGlow", { 
                                color: baseColor,
                                glowPower: 0.1,
                                taperPower: 1.0
                            });
                        } else {
                            material = Material.fromType("Color", { color: baseColor.withAlpha(0.7) });
                        }

                        item.polylinePrimitive = polylines.add({
                            positions: item.trailPositions,
                            width: trailOpts.width || 2,
                            material: material,
                        });
                    }
                } else if (item.polylinePrimitive) {
                    // Removed or no longer valid
                    if (!item.polylinePrimitive.isDestroyed?.()) {
                        polylines.remove(item.polylinePrimitive);
                    }
                    item.polylinePrimitive = undefined;
                    item.trailPositions = undefined;
                }
            }
        };

        viewer.scene.preUpdate.addEventListener(updateTrails);

        return () => {
            if (!viewer.isDestroyed()) {
                viewer.scene.preUpdate.removeEventListener(updateTrails);
                const collections = getCollections(viewer);
                const polylines = collections.polylines;
                if (polylines) {
                    for (const item of animatablesMapRef.current.values()) {
                        if (item.polylinePrimitive && !item.polylinePrimitive.isDestroyed?.()) {
                            polylines.remove(item.polylinePrimitive);
                            item.polylinePrimitive = undefined;
                            item.trailPositions = undefined;
                        }
                    }
                }
            }
        };
    }, [viewer, isReady, animatablesMapRef]);
}

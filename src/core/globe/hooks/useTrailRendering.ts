import { useEffect } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import { Cartesian3, Color, Ellipsoid, Material, DistanceDisplayCondition } from "cesium";
import type { AnimatableItem } from "../EntityRenderer";
import { getCollections } from "../EntityRenderer";

export function useTrailRendering(
    viewer: CesiumViewer | null,
    isReady: boolean,
    animatablesMapRef: React.MutableRefObject<Map<string, AnimatableItem>>
) {
    useEffect(() => {
        if (!viewer || !isReady || viewer.isDestroyed()) return;

        let lastUpdateTime = 0;
        const updateTrails = () => {
            if (viewer.isDestroyed()) return;
            const now = Date.now();
            if (now - lastUpdateTime < 250) return; // Only process trails at 4Hz to prevent 50k item JS map-loop from locking the thread
            lastUpdateTime = now;

            const collections = getCollections(viewer);
            const polylines = collections.polylines;
            if (!polylines) return;

            const MAX_DIST_SQ = 250000000000; // 500km squared
            const cameraPos = viewer.camera.position;

            // Manage additions and removals
            for (const item of animatablesMapRef.current.values()) {
                const history = item.entity.properties.history as any[];
                let trailOpts = item.options.trailOptions;
                
                if (history && history.length > 0 && trailOpts) {
                    const isSelected = item.lastHighlightState === 'selected';
                    const isHovered = item.lastHighlightState === 'hovered';
                    const shouldHighlight = isSelected || isHovered;
                    
                    const distSq = Cartesian3.distanceSquared(cameraPos, item.posRef);
                    const isClose = distSq < MAX_DIST_SQ;

                    // WebGL Geometry Culling: Only push trailing polylines to Cesium memory if they are near the camera or actively highlighted
                    if (isClose || shouldHighlight) {
                        if (!item.trailPositions) {
                            try {
                                const altOffset = (item.entity.altitude || 0) + 100; // 100m offset to clear terrain depth test
                                item.trailPositions = history.map(point => 
                                    Cartesian3.fromDegrees(
                                        point.lon || point.longitude || 0, 
                                        point.lat || point.latitude || 0, 
                                        altOffset, 
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
                                distanceDisplayCondition: new DistanceDisplayCondition(0, 500000)
                            });
                        }

                        // Dynamically update trailing visibility and highlighting based on selection state
                        if (item.polylinePrimitive) {
                            const targetWidth = shouldHighlight ? (trailOpts.width || 2) * 2.5 : (trailOpts.width || 1);
                            if (item.polylinePrimitive.width !== targetWidth) item.polylinePrimitive.width = targetWidth;

                            const currentDDC = item.polylinePrimitive.distanceDisplayCondition;
                            if (shouldHighlight) {
                                if (currentDDC !== undefined) {
                                    item.polylinePrimitive.distanceDisplayCondition = undefined;
                                }
                            } else {
                                if (currentDDC === undefined || currentDDC.near !== 0 || currentDDC.far !== 500000) {
                                    item.polylinePrimitive.distanceDisplayCondition = new DistanceDisplayCondition(0, 500000);
                                }
                            }
                        }
                    } else {
                        // Math-culled: remove from geometry collection to save massive memory
                        if (item.polylinePrimitive) {
                            polylines.remove(item.polylinePrimitive);
                            item.polylinePrimitive = undefined;
                        }
                    }
                } else if (item.polylinePrimitive) {
                    // Removed or no longer valid
                    if (item.polylinePrimitive) {
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
                        if (item.polylinePrimitive) {
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

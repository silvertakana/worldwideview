import React, { useEffect, useMemo } from "react";
import { Color, Cartesian3, Rectangle, PolygonHierarchy, ClassificationType, ArcType } from "cesium";
import { Entity, PolygonGraphics, PolylineGraphics, CustomDataSource } from "resium";
import { useOsmStore } from "../store";

export function OSMBboxOverlay({ viewer, enabled }: { viewer: any; enabled: boolean }) {
    const { bboxLocked, showBbox, lockedBbox, currentBbox, setCurrentBbox } = useOsmStore();

    useEffect(() => {
        if (!viewer || !enabled) return;
        
        const updateBbox = () => {
             if (bboxLocked) return;
             const rect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
             if (rect) {
                 const marginLat = (rect.north - rect.south) * 0.15;
                 const marginLon = (rect.east - rect.west) * 0.15;
                 setCurrentBbox(new Rectangle(
                     rect.west + marginLon, rect.south + marginLat,
                     rect.east - marginLon, rect.north - marginLat
                 ));
             }
        };

        // Use 'changed' for continuous updates during movement
        viewer.camera.changed.addEventListener(updateBbox);
        viewer.camera.moveEnd.addEventListener(updateBbox);
        
        // Initial attempt
        updateBbox();

        // Temporary interval for 2 seconds to force updates while the globe/camera settles
        const initInterval = setInterval(updateBbox, 100);
        const timeout = setTimeout(() => clearInterval(initInterval), 2000);
        
        return () => {
            clearInterval(initInterval);
            clearTimeout(timeout);
            if (viewer && !viewer.isDestroyed()) {
                viewer.camera.changed.removeEventListener(updateBbox);
                viewer.camera.moveEnd.removeEventListener(updateBbox);
            }
        };
    }, [viewer, enabled, bboxLocked, setCurrentBbox]);

    const activeBbox = bboxLocked ? lockedBbox : currentBbox;

    const positions = useMemo(() => {
        if (!activeBbox) return [];
        return Cartesian3.fromRadiansArray([
            activeBbox.west, activeBbox.south,
            activeBbox.east, activeBbox.south,
            activeBbox.east, activeBbox.north,
            activeBbox.west, activeBbox.north,
            activeBbox.west, activeBbox.south,
        ]);
    }, [activeBbox]);

    // Don't render if layer is disabled OR if user has hidden the box
    if (!enabled || !activeBbox || !showBbox) return null;

    return (
        <CustomDataSource name="OSMSearchBBox">
            <Entity>
                <PolygonGraphics
                    hierarchy={new PolygonHierarchy(positions)}
                    fill={true}
                    material={Color.RED.withAlpha(0.25)}
                    classificationType={ClassificationType.BOTH}
                    arcType={ArcType.GEODESIC}
                    height={0}
                />
                <PolylineGraphics
                    positions={positions}
                    width={3}
                    material={Color.RED}
                    clampToGround={true}
                    arcType={ArcType.GEODESIC}
                />
            </Entity>
        </CustomDataSource>
    );
}

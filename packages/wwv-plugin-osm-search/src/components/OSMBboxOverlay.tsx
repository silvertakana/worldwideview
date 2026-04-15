import React, { useEffect } from "react";
import { Color, Cartesian3, Rectangle } from "cesium";
import { Entity, PolygonGraphics } from "resium";
import { useOsmStore } from "../store";

export function OSMBboxOverlay({ viewer, enabled }: { viewer: any; enabled: boolean }) {
    const { bboxLocked, lockedBbox, currentBbox, setCurrentBbox } = useOsmStore();

    useEffect(() => {
        if (!viewer || !enabled) return;
        const updateBbox = () => {
             if (bboxLocked) return;
             const rect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
             if (rect) {
                 const marginLat = (rect.north - rect.south) * 0.1;
                 const marginLon = (rect.east - rect.west) * 0.1;
                 setCurrentBbox(new Rectangle(
                     rect.west + marginLon, rect.south + marginLat,
                     rect.east - marginLon, rect.north - marginLat
                 ));
             }
        };

        viewer.camera.moveEnd.addEventListener(updateBbox);
        updateBbox();
        return () => viewer.camera.moveEnd.removeEventListener(updateBbox);
    }, [viewer, enabled, bboxLocked, setCurrentBbox]);

    if (!enabled) return null;
    const activeBbox = bboxLocked ? lockedBbox : currentBbox;
    if (!activeBbox) return null;

    return (
        <Entity>
            <PolygonGraphics
                hierarchy={Cartesian3.fromRadiansArray([
                    activeBbox.west, activeBbox.south,
                    activeBbox.east, activeBbox.south,
                    activeBbox.east, activeBbox.north,
                    activeBbox.west, activeBbox.north
                ])}
                fill={true}
                material={Color.RED.withAlpha(0.1)}
                outline={true}
                outlineColor={Color.RED}
            />
        </Entity>
    );
}

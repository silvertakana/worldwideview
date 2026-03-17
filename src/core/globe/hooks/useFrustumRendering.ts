/**
 * React hook that synchronises camera-plugin frustum outlines
 * with the Cesium viewer.
 *
 * Watches camera-layer entities and delegates to FrustumRenderer
 * for creation/update/removal of polyline entities.
 */

import { useEffect, useRef } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import type { GeoEntity } from "@/core/plugins/PluginTypes";
import { FrustumRenderer } from "@worldwideview/wwv-plugin-camera/FrustumRenderer";

export function useFrustumRendering(
    viewer: CesiumViewer | null,
    isReady: boolean,
    cameraEntities: GeoEntity[],
    layerEnabled: boolean,
) {
    const rendererRef = useRef<FrustumRenderer | null>(null);

    useEffect(() => {
        if (!viewer || !isReady || viewer.isDestroyed()) return;

        if (!rendererRef.current) {
            rendererRef.current = new FrustumRenderer();
        }

        if (!layerEnabled) {
            rendererRef.current.clear(viewer);
            return;
        }

        rendererRef.current.update(viewer, cameraEntities);

        return () => {
            if (!viewer.isDestroyed() && rendererRef.current) {
                rendererRef.current.clear(viewer);
            }
        };
    }, [viewer, isReady, cameraEntities, layerEnabled]);
}

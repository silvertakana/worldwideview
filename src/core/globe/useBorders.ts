import { useEffect, useRef } from "react";
import {
    BingMapsImageryProvider,
    BingMapsStyle,
    ImageryLayer,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";

/**
 * Hook that manages a Bing Maps labels-only imagery overlay.
 *
 * Uses AERIAL_WITH_LABELS_ON_DEMAND — a raster tile layer that includes
 * country names, political borders, cities, and roads. GPU-composited,
 * LOD-managed, and cached by Cesium — near-zero CPU overhead compared
 * to the old GeoJsonDataSource + Entity approach.
 */
export function useBorders(
    viewer: CesiumViewer | null,
    enabled: boolean,
    isGoogle3D: boolean = false,
) {
    const layerRef = useRef<ImageryLayer | null>(null);
    const providerReadyRef = useRef<boolean>(false);

    useEffect(() => {
        if (!viewer || viewer.isDestroyed()) return;

        // Labels overlay is not applicable when using Google 3D Tiles
        // (globe imagery layers are hidden in that mode).
        if (isGoogle3D) {
            hideLayer(viewer, layerRef);
            return;
        }

        async function setupOverlay() {
            if (!viewer || viewer.isDestroyed()) return;

            // Lazily create the imagery layer on first enable
            if (!layerRef.current && enabled) {
                try {
                    const provider = await createLabelProvider();
                    const layer = new ImageryLayer(provider, { alpha: 0.85 });
                    layerRef.current = layer;
                    providerReadyRef.current = true;
                } catch (err) {
                    console.warn("[useBorders] Failed to create label overlay", err);
                    return;
                }
            }

            const layer = layerRef.current;
            if (!layer) return;

            if (enabled) {
                if (!viewer.imageryLayers.contains(layer)) {
                    // Add on top of all other imagery layers
                    viewer.imageryLayers.add(layer);
                }
                layer.show = true;
            } else {
                layer.show = false;
            }
        }

        setupOverlay();
    }, [viewer, enabled, isGoogle3D]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (viewer && !viewer.isDestroyed() && layerRef.current) {
                if (viewer.imageryLayers.contains(layerRef.current)) {
                    viewer.imageryLayers.remove(layerRef.current, true);
                }
                layerRef.current = null;
                providerReadyRef.current = false;
            }
        };
    }, [viewer]);
}

/** Hide and remove the label layer if it exists */
function hideLayer(
    viewer: CesiumViewer,
    layerRef: React.RefObject<ImageryLayer | null>,
) {
    if (layerRef.current) {
        layerRef.current.show = false;
    }
}

/** Create a Bing Maps labels-only imagery provider */
async function createLabelProvider(): Promise<BingMapsImageryProvider> {
    const bingKey = process.env.NEXT_PUBLIC_BING_MAPS_KEY;

    if (bingKey) {
        return BingMapsImageryProvider.fromUrl(
            "https://dev.virtualearth.net",
            {
                key: bingKey,
                mapStyle: BingMapsStyle.AERIAL_WITH_LABELS_ON_DEMAND,
            },
        );
    }

    // Fallback: Bing Maps via Cesium Ion (asset 3 = Bing Aerial w/ Labels)
    return BingMapsImageryProvider.fromUrl(
        "https://dev.virtualearth.net",
        {
            mapStyle: BingMapsStyle.AERIAL_WITH_LABELS_ON_DEMAND,
        },
    );
}

import { useEffect, useRef } from "react";
import {
    Viewer as CesiumViewer,
    ImageryLayer,
    SceneMode,
    Cesium3DTileset,
    Cesium3DTileStyle,
    createOsmBuildingsAsync
} from "cesium";
import { useStore } from "@/core/state/store";
import { createImageryProvider, createOsmProvider } from "./ImageryProviderFactory";

export function useImageryManager(viewer: CesiumViewer | null, viewerReady: boolean) {
    const baseLayerId = useStore((s) => s.mapConfig.baseLayerId);
    const fallbackLayerId = useStore((s) => s.mapConfig.fallbackLayerId);
    const sceneMode = useStore((s) => s.mapConfig.sceneMode);
    const showOsmBuildings = useStore((s) => s.mapConfig.showOsmBuildings);

    // Resolve runtime truth:
    const activeLayerId = fallbackLayerId || baseLayerId;

    const currentImageryLayerRef = useRef<ImageryLayer | null>(null);
    const googleTilesetRef = useRef<Cesium3DTileset | null>(null);
    const osmBuildingsRef = useRef<Cesium3DTileset | null>(null);

    // 1. Manage Scene Mode (2D / 3D / Columbus)
    useEffect(() => {
        if (!viewer || !viewerReady || viewer.isDestroyed()) return;

        let targetMode = SceneMode.SCENE3D;
        if (sceneMode === 1) targetMode = SceneMode.COLUMBUS_VIEW;
        if (sceneMode === 2) targetMode = SceneMode.SCENE2D;

        if (viewer.scene.mode !== targetMode) {
            if (targetMode === SceneMode.SCENE2D) viewer.scene.morphTo2D(1.0);
            else if (targetMode === SceneMode.SCENE3D) viewer.scene.morphTo3D(1.0);
            else if (targetMode === SceneMode.COLUMBUS_VIEW) viewer.scene.morphToColumbusView(1.0);
        }
    }, [viewer, viewerReady, sceneMode]);

    // 2. Manage Imagery Layer and Google 3D Tiles
    useEffect(() => {
        if (!viewer || !viewerReady || viewer.isDestroyed()) return;

        async function updateImagery() {
            if (!viewer || !viewerReady || viewer.isDestroyed()) return;

            // Handle Google 3D Tiles specifically
            const isGoogle3D = activeLayerId === "google-3d";

            // Toggle Google 3D Tileset visibility if it exists
            // Or find it in primitives
            const primitives = viewer.scene.primitives;
            let foundTileset: Cesium3DTileset | null = null;

            for (let i = 0; i < primitives.length; i++) {
                const p = primitives.get(i);
                // Find the Google tileset — skip any tagged as OSM buildings
                if (p instanceof Cesium3DTileset && !(p as any)._wwvOsmBuildings) {
                    foundTileset = p;
                    break;
                }
            }

            if (foundTileset) {
                foundTileset.show = isGoogle3D;
            }

            // If we are in Google 3D mode, we usually hide the globe surface 
            // to avoid z-fighting or showing low-res imagery underneath
            viewer.scene.globe.show = !isGoogle3D;

            // Manage standard imagery layer
            if (isGoogle3D) {
                // Remove current custom imagery if switching to Google 3D
                if (currentImageryLayerRef.current) {
                    viewer.imageryLayers.remove(currentImageryLayerRef.current);
                    currentImageryLayerRef.current = null;
                }
            } else {
                // Instantiate and Add new imagery provider
                try {
                    const provider = await createImageryProvider(activeLayerId);
                    const newLayer = new ImageryLayer(provider);

                    if (currentImageryLayerRef.current) {
                        viewer.imageryLayers.remove(currentImageryLayerRef.current);
                    }

                    // Add as base layer (bottom)
                    if (viewer.isDestroyed()) return;
                    viewer.imageryLayers.add(newLayer, 0);
                    currentImageryLayerRef.current = newLayer;
                } catch (err) {
                    console.error("[useImageryManager] Failed to load imagery:", activeLayerId, err);
                    try {
                        const osmProvider = createOsmProvider();
                        const osmLayer = new ImageryLayer(osmProvider);
                        if (viewer.isDestroyed()) return;
                        viewer.imageryLayers.add(osmLayer, 0);
                        currentImageryLayerRef.current = osmLayer;
                        console.warn("[useImageryManager] Loaded OSM as fallback imagery");
                    } catch (fallbackErr) {
                        console.error("[useImageryManager] OSM fallback also failed:", fallbackErr);
                    }
                }
            }
        }

        updateImagery();
    }, [viewer, viewerReady, baseLayerId, fallbackLayerId]);

    // 3. Manage OSM 3D Buildings (only in 3D mode, not with Google Photorealistic tiles)
    const isGoogle3D = activeLayerId === "google-3d";
    const is3DMode = sceneMode === 3;
    useEffect(() => {
        if (!viewer || !viewerReady || viewer.isDestroyed()) return;

        const shouldShow = showOsmBuildings && !isGoogle3D && is3DMode;

        if (shouldShow && !osmBuildingsRef.current) {
            let cancelled = false;
            createOsmBuildingsAsync().then((tileset) => {
                if (cancelled || !viewer || viewer.isDestroyed()) {
                    tileset.destroy();
                    return;
                }
                (tileset as any)._wwvOsmBuildings = true;
                tileset.maximumScreenSpaceError = 16;
                tileset.style = new Cesium3DTileStyle({
                    color: "color('#E0DDD5')",
                });
                viewer.scene.primitives.add(tileset);
                osmBuildingsRef.current = tileset;
            }).catch((err) => {
                console.warn("[useImageryManager] Failed to load OSM 3D Buildings:", err);
            });
            return () => { cancelled = true; };
        }

        if (!shouldShow && osmBuildingsRef.current) {
            if (!viewer.isDestroyed()) {
                viewer.scene.primitives.remove(osmBuildingsRef.current);
            }
            osmBuildingsRef.current = null;
        }
    }, [viewer, viewerReady, isGoogle3D, is3DMode, showOsmBuildings]);

    return {
        isGoogle3D
    };
}

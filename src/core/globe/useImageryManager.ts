import { useEffect, useRef } from "react";
import {
    Viewer as CesiumViewer,
    ImageryLayer,
    SceneMode,
    Cesium3DTileset
} from "cesium";
import { useStore } from "@/core/state/store";
import { createImageryProvider } from "./ImageryProviderFactory";

export function useImageryManager(viewer: CesiumViewer | null) {
    const baseLayerId = useStore((s) => s.mapConfig.baseLayerId);
    const sceneMode = useStore((s) => s.mapConfig.sceneMode);

    const currentImageryLayerRef = useRef<ImageryLayer | null>(null);
    const googleTilesetRef = useRef<Cesium3DTileset | null>(null);

    // 1. Manage Scene Mode (2D / 3D / Columbus)
    useEffect(() => {
        if (!viewer || viewer.isDestroyed()) return;

        let targetMode = SceneMode.SCENE3D;
        if (sceneMode === 1) targetMode = SceneMode.COLUMBUS_VIEW;
        if (sceneMode === 2) targetMode = SceneMode.SCENE2D;

        if (viewer.scene.mode !== targetMode) {
            if (targetMode === SceneMode.SCENE2D) viewer.scene.morphTo2D(1.0);
            else if (targetMode === SceneMode.SCENE3D) viewer.scene.morphTo3D(1.0);
            else if (targetMode === SceneMode.COLUMBUS_VIEW) viewer.scene.morphToColumbusView(1.0);
        }
    }, [viewer, sceneMode]);

    // 2. Manage Imagery Layer and Google 3D Tiles
    useEffect(() => {
        if (!viewer || viewer.isDestroyed()) return;

        async function updateImagery() {
            if (!viewer || viewer.isDestroyed()) return;

            // Handle Google 3D Tiles specifically
            const isGoogle3D = baseLayerId === "google-3d";

            // Toggle Google 3D Tileset visibility if it exists
            // Or find it in primitives
            const primitives = viewer.scene.primitives;
            let foundTileset: Cesium3DTileset | null = null;

            for (let i = 0; i < primitives.length; i++) {
                const p = primitives.get(i);
                // Simple check for Google Tileset - usually it's the only 3DTileset 
                // added during initialization or has custom properties
                if (p instanceof Cesium3DTileset) {
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
                    const provider = await createImageryProvider(baseLayerId);
                    const newLayer = new ImageryLayer(provider);

                    if (currentImageryLayerRef.current) {
                        viewer.imageryLayers.remove(currentImageryLayerRef.current);
                    }

                    // Add as base layer (bottom)
                    viewer.imageryLayers.add(newLayer, 0);
                    currentImageryLayerRef.current = newLayer;
                } catch (err) {
                    console.error("[useImageryManager] Failed to load imagery:", baseLayerId, err);
                }
            }
        }

        updateImagery();
    }, [viewer, baseLayerId]);

    return {
        isGoogle3D: baseLayerId === "google-3d"
    };
}

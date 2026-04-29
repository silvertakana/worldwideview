import { useCallback, useRef, useState } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import { Cartesian3, CameraEventType, KeyboardEventModifier, createGooglePhotorealistic3DTileset, GoogleMaps } from "cesium";
import { dataBus } from "@/core/data/DataBus";
import { initPrimitiveCollections } from "../EntityRenderer";
import { getUserApiKey } from "@/lib/userApiKeys";
import { useStore } from "@/core/state/store";

export function useViewerInitialization(sceneSettings: any) {
    const viewerRef = useRef<CesiumViewer | null>(null);
    const [viewerReady, setViewerReady] = useState(false);

    const handleViewerReady = useCallback(async (viewer: CesiumViewer) => {
        viewerRef.current = viewer;

        // 1. Core Viewer Settings (Sync)
        viewer.imageryLayers.removeAll();
        viewer.scene.requestRenderMode = true;
        viewer.scene.maximumRenderTimeChange = 0.5;
        viewer.scene.debugShowFramesPerSecond = sceneSettings.showFps;
        viewer.resolutionScale = sceneSettings.resolutionScale;
        viewer.scene.postProcessStages.fxaa.enabled = sceneSettings.antiAliasing === "fxaa";
        viewer.scene.msaaSamples = sceneSettings.antiAliasing === "none" || sceneSettings.antiAliasing === "fxaa" ? 1 : parseInt(sceneSettings.antiAliasing.replace("msaa", "").replace("x", ""), 10) || 1;
        viewer.scene.globe.depthTestAgainstTerrain = true;

        // Configure Screen Space Camera
        const sscc = viewer.scene.screenSpaceCameraController;
        sscc.tiltEventTypes = [
            CameraEventType.MIDDLE_DRAG,
            CameraEventType.RIGHT_DRAG,
            CameraEventType.PINCH,
            { eventType: CameraEventType.LEFT_DRAG, modifier: KeyboardEventModifier.CTRL },
            { eventType: CameraEventType.RIGHT_DRAG, modifier: KeyboardEventModifier.CTRL }
        ];
        sscc.zoomEventTypes = [CameraEventType.WHEEL, CameraEventType.PINCH];

        if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
            (sscc as any)._zoomFactor = 5;
            (sscc as any)._translateFactor = 2;
            (sscc as any)._tiltFactor = 50;
        }

        // Initialize collections so renderers can start immediately
        initPrimitiveCollections(viewer);
        
        // Initial Camera Position (Sync)
        viewer.camera.setView({ destination: Cartesian3.fromDegrees(0, 20, 10000000) });

        // Signal ready NOW so UI and Overlays (OSM Box) appear instantly
        setViewerReady(true);

        // 2. Heavy/Async Data Loading (Background)
        let globeFired = false;
        const fireGlobeReady = () => {
            if (globeFired) return;
            globeFired = true;
            if (!viewer.isDestroyed()) {
                viewer.camera.setView({ destination: Cartesian3.fromDegrees(0, 20, 60000000) });
            }
            dataBus.emit("globeReady", {} as Record<string, never>);
        };

        const globalTimeout = setTimeout(() => {
            console.warn("[GlobeView] Global tile-init timeout (15s) — forcing globe ready.");
            fireGlobeReady();
        }, 15_000);

        try {
            const envKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
            const userGoogleKey = getUserApiKey("google_maps");
            const activeKey = (userGoogleKey && userGoogleKey.length >= 20) ? userGoogleKey : envKey;
            
            let googleLoaded = false;
            
            if (activeKey && activeKey.length >= 20) {
                GoogleMaps.defaultApiKey = activeKey;
                try {
                    const tileset = await createGooglePhotorealistic3DTileset({
                        onlyUsingWithGoogleGeocoder: true,
                        ...({ enableCollision: true } as Record<string, unknown>),
                    });

                    if (viewer.isDestroyed()) {
                        clearTimeout(globalTimeout);
                        return;
                    }

                    tileset.maximumScreenSpaceError = sceneSettings.maxScreenSpaceError;
                    (tileset as any).maximumMemoryUsage = 2048; 
                    viewer.scene.primitives.add(tileset);

                    const removeListener = tileset.initialTilesLoaded.addEventListener(() => {
                        console.log("[GlobeView] Initial tiles loaded — syncing state.");
                        useStore.getState().updateMapConfig({ baseLayerId: "google-3d" });
                        clearTimeout(globalTimeout);
                        fireGlobeReady();
                        removeListener();
                    });
                    googleLoaded = true;
                } catch (err: any) {
                    console.error("[GlobeView] Failed to initialize Google 3D Tiles:", err);
                }
            }

            if (!googleLoaded) {
                 if (useStore.getState().mapConfig.baseLayerId === "google-3d") {
                      useStore.getState().updateMapConfig({ fallbackLayerId: "bing-aerial" });
                 }
                 clearTimeout(globalTimeout);
                 fireGlobeReady();
            }
        } catch (err) {
            console.error("[GlobeView] Unexpected error during early globe init:", err);
            fireGlobeReady();
        }
    }, [sceneSettings]);

    return { viewerRef, viewerReady, handleViewerReady };
}

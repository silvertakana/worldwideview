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

        // CesiumJS may initialize a default imagery layer even with Resium's
        // baseLayer={false}. Strip it so useImageryManager is the sole controller.
        viewer.imageryLayers.removeAll();

        viewer.scene.requestRenderMode = true;
        viewer.scene.maximumRenderTimeChange = 0.5;
        // viewer.scene.orderIndependentTranslucency is read-only in newer Cesium versions and no longer configurable
        viewer.scene.debugShowFramesPerSecond = sceneSettings.showFps;
        viewer.resolutionScale = sceneSettings.resolutionScale;
        viewer.scene.postProcessStages.fxaa.enabled = sceneSettings.antiAliasing === "fxaa";
        viewer.scene.msaaSamples = sceneSettings.antiAliasing === "none" || sceneSettings.antiAliasing === "fxaa" ? 1 : parseInt(sceneSettings.antiAliasing.replace("msaa", "").replace("x", ""), 10) || 1;
        viewer.scene.globe.depthTestAgainstTerrain = true;

        viewer.camera.setView({ destination: Cartesian3.fromDegrees(0, 20, 10000000) });

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
                        console.warn("[GlobeView] Viewer destroyed during tileset init — aborting.");
                        clearTimeout(globalTimeout);
                        return;
                    }

                    tileset.maximumScreenSpaceError = sceneSettings.maxScreenSpaceError;
                    // Increase the local cache of downloaded tiles from the default 512MB to 2048MB.
                    // This massively mitigates duplicate tile API requests hitting Google when users
                    // pan around the map in local areas.
                    (tileset as any).maximumMemoryUsage = 2048; 
                    viewer.scene.primitives.add(tileset);

                    const removeListener = tileset.initialTilesLoaded.addEventListener(() => {
                        console.log("[GlobeView] Initial tiles loaded — syncing state and firing ready.");
                        useStore.getState().updateMapConfig({ baseLayerId: "google-3d" });
                        clearTimeout(globalTimeout);
                        fireGlobeReady();
                        removeListener();
                    });
                    googleLoaded = true;
                } catch (err: any) {
                    console.error("[GlobeView] Failed to initialize Google 3D Tiles:", err);
                    useStore.getState().showErrorToast("Google 3D Tiles failed to load: " + (err.message || "Invalid Key or 403 Forbidden"));
                    // We fall through to local map fallback below.
                }
            }

            if (!googleLoaded) {
                 console.log("[GlobeView] Google 3D Tiles inactive/unauthorized. Falling back to default flat imagery.");
                 if (useStore.getState().mapConfig.baseLayerId === "google-3d") {
                      useStore.getState().updateMapConfig({ fallbackLayerId: "bing-aerial" });
                 }
                 clearTimeout(globalTimeout);
                 fireGlobeReady();
            }
        } catch (err) {
            console.error("[GlobeView] Unexpected error during early globe init:", err);
            if (useStore.getState().mapConfig.baseLayerId === "google-3d") {
                 useStore.getState().updateMapConfig({ fallbackLayerId: "bing-aerial" });
            }
            clearTimeout(globalTimeout);
            fireGlobeReady();
        }

        if (viewer.isDestroyed()) return;
        initPrimitiveCollections(viewer);

        const sscc = viewer.scene.screenSpaceCameraController;
        sscc.tiltEventTypes = [
            CameraEventType.MIDDLE_DRAG,
            CameraEventType.RIGHT_DRAG,
            CameraEventType.PINCH,
            { eventType: CameraEventType.LEFT_DRAG, modifier: KeyboardEventModifier.CTRL },
            { eventType: CameraEventType.RIGHT_DRAG, modifier: KeyboardEventModifier.CTRL }
        ];
        sscc.zoomEventTypes = [
            CameraEventType.WHEEL,
            CameraEventType.PINCH
        ];

        if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
            (sscc as any)._zoomFactor = 15;
            (sscc as any)._translateFactor = 2;
            (sscc as any)._tiltFactor = 50;
        }

        setViewerReady(true);
    }, [sceneSettings]);

    return { viewerRef, viewerReady, handleViewerReady };
}

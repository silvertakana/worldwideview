import { useCallback, useRef, useState } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import { Cartesian3, CameraEventType, KeyboardEventModifier, createGooglePhotorealistic3DTileset } from "cesium";
import { dataBus } from "@/core/data/DataBus";
import { initPrimitiveCollections } from "../EntityRenderer";

export function useViewerInitialization(sceneSettings: any) {
    const viewerRef = useRef<CesiumViewer | null>(null);
    const [viewerReady, setViewerReady] = useState(false);

    const handleViewerReady = useCallback(async (viewer: CesiumViewer) => {
        viewerRef.current = viewer;
        viewer.scene.requestRenderMode = true;
        viewer.scene.maximumRenderTimeChange = 0.5;
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
            const tileset = await createGooglePhotorealistic3DTileset({
                key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || undefined,
                onlyUsingWithGoogleGeocoder: true,
                ...({ enableCollision: true } as Record<string, unknown>),
            });

            if (viewer.isDestroyed()) {
                console.warn("[GlobeView] Viewer destroyed during tileset init — aborting.");
                clearTimeout(globalTimeout);
                return;
            }

            tileset.maximumScreenSpaceError = sceneSettings.maxScreenSpaceError;
            viewer.scene.primitives.add(tileset);

            const removeListener = tileset.initialTilesLoaded.addEventListener(() => {
                console.log("[GlobeView] Initial tiles loaded — globe ready.");
                clearTimeout(globalTimeout);
                fireGlobeReady();
                removeListener();
            });
        } catch (err) {
            console.warn("[GlobeView] Failed to initialize Google 3D Tiles:", err);
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

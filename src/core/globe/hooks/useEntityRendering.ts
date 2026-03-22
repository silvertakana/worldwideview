import { useEffect, useRef } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";
import { renderEntities, AnimatableItem } from "../EntityRenderer";
import { createUpdateLoop } from "../AnimationLoop";


export function useEntityRendering(
    viewer: CesiumViewer | null,
    isReady: boolean,
    visibleEntities: Array<{ entity: GeoEntity; options: CesiumEntityOptions }>,
    animatablesMapRef: React.MutableRefObject<Map<string, AnimatableItem>>,
    hoveredEntityIdRef: React.MutableRefObject<string | null>,
    sceneSettings: {
        showFps: boolean;
        resolutionScale: number;
        msaaSamples: number;
        enableFxaa: boolean;
        maxScreenSpaceError: number;
    }
) {
    // Cached array ref — rebuilt only after renderEntities, not every frame
    const cachedAnimatablesRef = useRef<{ current: AnimatableItem[] }>({ current: [] });

    useEffect(() => {
        if (!viewer || !isReady || viewer.isDestroyed()) return;

        // Sync scene settings
        viewer.scene.debugShowFramesPerSecond = sceneSettings.showFps;
        viewer.resolutionScale = sceneSettings.resolutionScale;
        viewer.scene.msaaSamples = sceneSettings.msaaSamples;
        viewer.scene.postProcessStages.fxaa.enabled = sceneSettings.enableFxaa;
        const primitives = viewer.scene.primitives as any;
        for (let i = 0; i < primitives.length; i++) {
            const p = primitives.get(i);
            if (p?.maximumScreenSpaceError !== undefined) {
                p.maximumScreenSpaceError = sceneSettings.maxScreenSpaceError;
            }
        }

        // Attach animation loop with cached array ref (no per-frame allocation)
        const updatePositions = createUpdateLoop(
            viewer,
            cachedAnimatablesRef.current,
            hoveredEntityIdRef
        );
        viewer.scene.preUpdate.addEventListener(updatePositions);

        // Synchronous render — all entities processed atomically in a single frame
        renderEntities(viewer, visibleEntities, animatablesMapRef.current);

        // Rebuild cached array after render
        cachedAnimatablesRef.current.current = Array.from(animatablesMapRef.current.values());

        // Signal Cesium that the scene needs a re-render (requestRenderMode is on)
        viewer.scene.requestRender();

        return () => {
            if (!viewer.isDestroyed()) {
                viewer.scene.preUpdate.removeEventListener(updatePositions);
                // Synchronously flush all labels to prevent stale labels persisting
                const labels = (viewer as any)?._wwvLabels;
                if (labels) {
                    for (const item of animatablesMapRef.current.values()) {
                        if (item.labelPrimitive && !item.labelPrimitive.isDestroyed?.()) {
                            labels.remove(item.labelPrimitive);
                            item.labelPrimitive = undefined;
                        }
                    }
                }
            }
        };
    }, [
        viewer,
        isReady,
        visibleEntities,
        sceneSettings.showFps,
        sceneSettings.resolutionScale,
        sceneSettings.msaaSamples,
        sceneSettings.enableFxaa,
        sceneSettings.maxScreenSpaceError,
        animatablesMapRef,
        hoveredEntityIdRef
    ]);
}

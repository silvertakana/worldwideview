import { useEffect } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";
import { renderEntitiesChunked, renderEntities, AnimatableItem } from "../EntityRenderer";
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

        let updatePositions: (() => void) | undefined;

        // Use chunked rendering for large updates to prevent main thread lockups
        renderEntitiesChunked(viewer, visibleEntities, animatablesMapRef.current).then(animatables => {
            if (!viewer || viewer.isDestroyed()) return;
            updatePositions = createUpdateLoop(viewer, animatables, hoveredEntityIdRef);
            viewer.scene.preUpdate.addEventListener(updatePositions);
        });

        return () => {
            if (updatePositions && !viewer.isDestroyed()) {
                viewer.scene.preUpdate.removeEventListener(updatePositions);
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

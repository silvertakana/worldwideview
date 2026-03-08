import {
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    defined,
    SceneMode,
} from "cesium";
import type { Viewer as CesiumViewer, Cartesian2 } from "cesium";
import type { GeoEntity } from "@/core/plugins/PluginTypes";
import { useStore } from "@/core/state/store";

/**
 * Pick a WorldWideView entity at a screen position using the Cesium scene.pick API.
 */
function findEntityAtPosition(viewer: CesiumViewer, position: { x: number; y: number }): GeoEntity | null {
    if (!viewer || viewer.isDestroyed()) return null;
    const picked = viewer.scene.pick(position as Cartesian2);
    if (defined(picked) && picked.id && picked.id._wwvEntity) {
        return picked.id._wwvEntity as GeoEntity;
    }
    return null;
}

/**
 * Sets up click and hover handlers on the viewer canvas.
 * Returns a cleanup function that destroys the handler and resets the cursor.
 */
export function setupInteractionHandlers(
    viewer: CesiumViewer,
    hoveredEntityIdRef: React.MutableRefObject<string | null>
): () => void {
    if (!viewer || viewer.isDestroyed() || !viewer.scene) {
        return () => { };
    }
    const canvas = viewer.scene.canvas;

    const setSelectedEntity = useStore.getState().setSelectedEntity;
    const setHoveredEntity = useStore.getState().setHoveredEntity;

    const handler = new ScreenSpaceEventHandler(canvas);

    // Click → select entity
    handler.setInputAction(
        (event: { position: { x: number; y: number } }) => {
            if (!viewer || viewer.isDestroyed()) return;
            const entity = findEntityAtPosition(viewer, event.position);
            useStore.getState().setSelectedEntity(entity);
            if (entity) {
                useStore.getState().setHoveredEntity(null, null);
                hoveredEntityIdRef.current = null;
            }
        },
        ScreenSpaceEventType.LEFT_CLICK
    );

    // Hover → show tooltip card
    let hoverTimeout: NodeJS.Timeout | null = null;
    const HOVER_THROTTLE_MS = 150; // Increased from 100ms to 150ms to allow more frames to render between picks

    handler.setInputAction(
        (event: { endPosition: { x: number; y: number } }) => {
            const pos = { x: event.endPosition.x, y: event.endPosition.y };

            // Only update screen position continuously if we ALREADY have a hovered entity
            // This prevents React state thrashing when just moving the mouse over empty space
            if (hoveredEntityIdRef.current) {
                useStore.getState().setHoveredEntity(useStore.getState().hoveredEntity, pos);
            }

            // Debounce the expensive scene.pick operation
            if (hoverTimeout !== null) {
                clearTimeout(hoverTimeout);
            }

            hoverTimeout = setTimeout(() => {
                hoverTimeout = null;

                // Skip if viewer was destroyed (e.g. during HMR or navigation)
                if (!viewer || viewer.isDestroyed()) return;

                // Skip picking if scene is morphing (e.g. 2D to 3D transition)
                if (viewer.scene.mode === SceneMode.MORPHING) return;

                const entity = findEntityAtPosition(viewer, pos);
                const prevId = hoveredEntityIdRef.current;
                const newId = entity ? entity.id : null;

                // Only update React state if the hovered entity CHANGED
                if (prevId !== newId) {
                    hoveredEntityIdRef.current = newId;
                    canvas.style.cursor = entity ? "pointer" : "default";
                    useStore.getState().setHoveredEntity(
                        entity,
                        entity ? pos : null
                    );
                }
            }, HOVER_THROTTLE_MS);
        },
        ScreenSpaceEventType.MOUSE_MOVE
    );

    return () => {
        if (hoverTimeout !== null) clearTimeout(hoverTimeout);
        handler.destroy();
        canvas.style.cursor = "default";
    };
}

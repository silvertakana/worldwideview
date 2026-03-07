import { useEffect } from "react";
import type { Viewer as CesiumViewer, Entity as CesiumEntity } from "cesium";
import { Cartesian3, CallbackProperty } from "cesium";
import type { AnimatableItem } from "../EntityRenderer";

export function useSelectionAnchor(
    viewer: CesiumViewer | null,
    isReady: boolean,
    selectedEntity: any,
    selectionEntityRef: React.MutableRefObject<CesiumEntity | null>,
    animatablesMapRef: React.MutableRefObject<Map<string, AnimatableItem>>
) {
    // Initialization of Selection Entity
    useEffect(() => {
        if (!viewer || viewer.isDestroyed() || !isReady) return;

        let entity: CesiumEntity | null = null;
        try {
            // Create a hidden entity for camera tracking/flying
            if (!viewer.entities) {
                console.warn("[GlobeView] Viewer entities collection not available during selection anchor init");
                return;
            }

            entity = viewer.entities.add({
                id: "__wwv_selection_anchor",
                point: {
                    pixelSize: 0,
                }
            });
            selectionEntityRef.current = entity;
        } catch (error) {
            console.warn("[GlobeView] Error accessing viewer entities:", error);
            return;
        }

        return () => {
            try {
                if (viewer && !viewer.isDestroyed() && viewer.entities && entity) {
                    viewer.entities.remove(entity);
                }
            } catch (error) {
                // Ignore cleanup errors if viewer is partially destroyed
            }
        };
    }, [viewer, isReady, selectionEntityRef]);

    // Update Selection Entity Position — use CallbackProperty to track extrapolated position
    useEffect(() => {
        const selectionEntity = selectionEntityRef.current;
        if (!selectionEntity || !selectedEntity) return;

        const entityId = selectedEntity.id;

        // Use a CallbackProperty so viewer.trackedEntity follows the
        // extrapolated position in real-time, not just the polled position.
        const fallbackPos = Cartesian3.fromDegrees(
            selectedEntity.longitude,
            selectedEntity.latitude,
            selectedEntity.altitude || 0
        );

        selectionEntity.position = new CallbackProperty(() => {
            const item = animatablesMapRef.current?.get(entityId);
            return item ? item.posRef : fallbackPos;
        }, false) as any;
    }, [selectedEntity, selectionEntityRef, animatablesMapRef]);
}

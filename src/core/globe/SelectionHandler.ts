import {
    Cartesian3,
    Color,
    Math as CesiumMath,
    PolylineDashMaterialProperty,
    Entity as CesiumEntity,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import type { GeoEntity } from "@/core/plugins/PluginTypes";
import { pluginManager } from "@/core/plugins/PluginManager";

/**
 * Fly camera to a selected entity and optionally render a motion trail.
 * Returns a cleanup function that removes the trail entity.
 */
export function handleEntitySelection(
    viewer: CesiumViewer,
    selectedEntity: GeoEntity,
    trailEntityRef: React.MutableRefObject<CesiumEntity | null>
): void {
    // Clean up previous trail
    if (trailEntityRef.current) {
        viewer.entities.remove(trailEntityRef.current);
        trailEntityRef.current = null;
    }

    // Get selection behavior from plugin
    const managed = pluginManager.getPlugin(selectedEntity.pluginId);
    const behavior = managed?.plugin.getSelectionBehavior?.(selectedEntity) ?? null;

    // Fly camera to entity
    const entityAlt = selectedEntity.altitude || 0;
    const offsetMultiplier = behavior?.flyToOffsetMultiplier ?? 3;
    const baseDistance = behavior?.flyToBaseDistance ?? 30000;
    const viewDistance = Math.max(50000, entityAlt * offsetMultiplier + baseDistance);

    viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(
            selectedEntity.longitude,
            selectedEntity.latitude,
            entityAlt + viewDistance
        ),
        orientation: {
            heading: CesiumMath.toRadians(0),
            pitch: CesiumMath.toRadians(-45),
            roll: 0,
        },
        duration: 1.5,
    });

    // Render trail if plugin opts in
    if (behavior?.showTrail && selectedEntity.heading !== undefined) {
        const trailDuration = behavior.trailDurationSec ?? 60;
        const trailStep = behavior.trailStepSec ?? 5;
        const trailColor = behavior.trailColor ?? "#00fff7";

        const positions: Cartesian3[] = [];
        const speed = selectedEntity.speed || 200;
        const headingRad = CesiumMath.toRadians(selectedEntity.heading);

        for (let t = trailDuration; t >= 0; t -= trailStep) {
            const dist = speed * t;
            const dLat = -Math.cos(headingRad) * dist / 111320;
            const dLon = -Math.sin(headingRad) * dist / (111320 * Math.cos(CesiumMath.toRadians(selectedEntity.latitude)));
            positions.push(Cartesian3.fromDegrees(
                selectedEntity.longitude + dLon,
                selectedEntity.latitude + dLat,
                entityAlt
            ));
        }

        trailEntityRef.current = viewer.entities.add({
            polyline: {
                positions,
                width: 2,
                material: new PolylineDashMaterialProperty({
                    color: Color.fromCssColorString(trailColor).withAlpha(0.6),
                    dashLength: 16,
                }),
            } as any,
        });
    }
}

/**
 * Clean up trail entity on deselection.
 */
export function cleanupTrail(
    viewer: CesiumViewer,
    trailEntityRef: React.MutableRefObject<CesiumEntity | null>
): void {
    if (trailEntityRef.current) {
        viewer.entities.remove(trailEntityRef.current);
        trailEntityRef.current = null;
    }
}

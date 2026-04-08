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
import type { AnimatableItem } from "./EntityRenderer";

/**
 * Fly camera to a selected entity and optionally render a motion trail.
 * Uses the extrapolated posRef from the animatables map as the trail origin
 * so it matches the visually interpolated aircraft position.
 */
export function handleEntitySelection(
    viewer: CesiumViewer,
    selectedEntity: GeoEntity,
    trailEntityRef: React.MutableRefObject<CesiumEntity | null>,
    animatablesMap: Map<string, AnimatableItem>
): void {
    // Clean up previous trail
    if (trailEntityRef.current && !viewer.isDestroyed()) {
        viewer.entities.remove(trailEntityRef.current);
        trailEntityRef.current = null;
    }

    // Get selection behavior from plugin
    const managed = pluginManager.getPlugin(selectedEntity.pluginId);
    const behavior = managed?.plugin.getSelectionBehavior?.(selectedEntity) ?? null;

    // Render trail if plugin opts in
    if (behavior?.showTrail && selectedEntity.heading !== undefined) {
        const trailDuration = behavior.trailDurationSec ?? 60;
        const trailStep = behavior.trailStepSec ?? 5;
        const trailColor = behavior.trailColor ?? "#00fff7";

        // Use extrapolated position if available, otherwise raw polled position
        const item = animatablesMap.get(selectedEntity.id);
        const originLon = selectedEntity.longitude;
        const originLat = selectedEntity.latitude;
        const entityAlt = (selectedEntity.altitude || 0) + 10;

        const positions: Cartesian3[] = [];
        const speed = selectedEntity.speed ?? 200;
        const headingRad = CesiumMath.toRadians(selectedEntity.heading);

        for (let t = trailDuration; t >= 0; t -= trailStep) {
            const dist = speed * t;
            const dLat = -Math.cos(headingRad) * dist / 111320;
            const dLon = -Math.sin(headingRad) * dist / (111320 * Math.cos(CesiumMath.toRadians(originLat)));
            positions.push(Cartesian3.fromDegrees(
                originLon + dLon,
                originLat + dLat,
                entityAlt
            ));
        }

        // Add the current extrapolated position as the trail tip so it
        // connects to the visually interpolated aircraft position
        if (item) {
            positions.push(Cartesian3.clone(item.posRef));
        }

        if (viewer.isDestroyed()) return;
        trailEntityRef.current = viewer.entities.add({
            polyline: {
                positions,
                width: 2,
                material: new PolylineDashMaterialProperty({
                    color: Color.fromCssColorString(trailColor).withAlpha(0.6),
                    dashLength: 16,
                }),
                depthFailMaterial: new PolylineDashMaterialProperty({
                    color: Color.fromCssColorString(trailColor).withAlpha(0.2),
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
    if (trailEntityRef.current && !viewer.isDestroyed()) {
        viewer.entities.remove(trailEntityRef.current);
        trailEntityRef.current = null;
    }
}

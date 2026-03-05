import { Cartesian3, Color, Math as CesiumMath, Ellipsoid } from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";
import { useStore } from "@/core/state/store";
import { getEntityColor } from "./EntityRenderer";

interface AnimatableItem {
    primitive: any;
    labelPrimitive?: any;
    entity: GeoEntity;
    posRef: Cartesian3;
    options: CesiumEntityOptions;
    basePosition?: Cartesian3;
    velocityVector?: Cartesian3;
}

const R_WGS84_MIN = 6356752.0;
const R2 = R_WGS84_MIN * R_WGS84_MIN;

/**
 * Creates the per-frame update function for entity position extrapolation,
 * horizon culling, and highlight styling.
 */
export function createUpdateLoop(
    viewer: CesiumViewer,
    animatables: AnimatableItem[],
    hoveredEntityIdRef: React.MutableRefObject<string | null>
): () => void {
    let frameCount = 0;

    return () => {
        if (!viewer || viewer.isDestroyed()) return;

        const state = useStore.getState();
        const nowMs = state.isPlaybackMode ? state.currentTime.getTime() : Date.now();
        const cam = viewer.camera;
        const camPos = cam.positionWC;
        const camDistSqr = Cartesian3.magnitudeSquared(camPos);

        if (camDistSqr <= R2) return;

        const Dh = Math.sqrt(camDistSqr - R2);
        const isFullUpdate = frameCount++ % 2 === 0;

        for (let i = 0; i < animatables.length; i++) {
            const item = animatables[i];
            const { primitive, labelPrimitive, entity, posRef } = item;
            const isSelected = state.selectedEntity?.id === entity.id;
            const isHovered = hoveredEntityIdRef.current === entity.id;

            // Position extrapolation
            if (entity.timestamp && entity.speed !== undefined && entity.heading !== undefined) {
                if (isFullUpdate || isSelected || isHovered) {
                    extrapolatePosition(item, nowMs);
                }
            }

            // Horizon culling
            const posDistSqr = Cartesian3.magnitudeSquared(posRef);
            const Dph = Math.sqrt(Math.max(0, posDistSqr - R2));
            const distanceToPoint = Cartesian3.distance(camPos, posRef);
            const isVisible = distanceToPoint <= (Dh + Dph);
            primitive.show = isVisible;

            // Highlight styling
            applyHighlight(item, isSelected, isHovered);

            // Label visibility
            if (labelPrimitive) {
                const showLabel = isVisible && (distanceToPoint < 500000 || isSelected || isHovered);
                labelPrimitive.show = showLabel;
                labelPrimitive.fillColor = isSelected ? Color.fromCssColorString("#00fff7") : Color.WHITE;
            }
        }
    };
}

/** Extrapolate entity position forward/backward in time. */
function extrapolatePosition(item: AnimatableItem, nowMs: number): void {
    const { entity, posRef } = item;
    if (!entity.timestamp) return;

    const dtSec = (nowMs - entity.timestamp.getTime()) / 1000;
    if (Math.abs(dtSec) > 300) return;

    if (!item.velocityVector) {
        const headingRad = CesiumMath.toRadians(entity.heading!);
        const surfaceNormal = Ellipsoid.WGS84.geodeticSurfaceNormal(posRef);
        const northPole = new Cartesian3(0, 0, 1);

        let northDir = new Cartesian3();
        Cartesian3.cross(northPole, surfaceNormal, northDir);
        Cartesian3.cross(surfaceNormal, northDir, northDir);
        Cartesian3.normalize(northDir, northDir);

        let eastDir = new Cartesian3();
        Cartesian3.cross(northDir, surfaceNormal, eastDir);
        Cartesian3.normalize(eastDir, eastDir);

        const velocityVector = new Cartesian3();
        Cartesian3.multiplyByScalar(northDir, Math.cos(headingRad), velocityVector);
        const tempEast = new Cartesian3();
        Cartesian3.multiplyByScalar(eastDir, Math.sin(headingRad), tempEast);
        Cartesian3.add(velocityVector, tempEast, velocityVector);
        Cartesian3.multiplyByScalar(velocityVector, entity.speed!, velocityVector);

        item.basePosition = Cartesian3.clone(posRef);
        item.velocityVector = velocityVector;
    }

    const displacement = new Cartesian3();
    Cartesian3.multiplyByScalar(item.velocityVector!, dtSec, displacement);
    Cartesian3.add(item.basePosition!, displacement, posRef);

    item.primitive.position = posRef;
    if (item.labelPrimitive) item.labelPrimitive.position = posRef;
}

/** Apply selected/hovered/normal highlight styling. */
function applyHighlight(item: AnimatableItem, isSelected: boolean, isHovered: boolean): void {
    const { primitive, options } = item;

    if (isSelected) {
        primitive.color = Color.fromCssColorString("#00fff7");
        if (options.type === "billboard") {
            primitive.scale = 0.7;
        } else {
            primitive.pixelSize = (options.size || 6) * 2.0;
            primitive.outlineColor = Color.fromCssColorString("#00fff7");
            primitive.outlineWidth = 3;
        }
    } else if (isHovered) {
        primitive.color = Color.YELLOW;
        if (options.type === "billboard") {
            primitive.scale = 0.6;
        } else {
            primitive.pixelSize = (options.size || 6) * 1.5;
            primitive.outlineColor = Color.YELLOW;
            primitive.outlineWidth = 2;
        }
    } else {
        primitive.color = getEntityColor(options);
        if (options.type === "billboard") {
            primitive.scale = 0.5;
        } else {
            primitive.pixelSize = options.size || 6;
            primitive.outlineColor = options.outlineColor
                ? Color.fromCssColorString(options.outlineColor)
                : Color.BLACK;
            primitive.outlineWidth = options.outlineWidth || 1;
        }
    }
}

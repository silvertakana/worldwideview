import {
    Cartesian3,
    Color,
    Math as CesiumMath,
    Ellipsoid,
    BoundingSphere,
    Intersect,
    CullingVolume
} from "cesium";
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

// Pre-allocate objects for Zero-Allocation Loop
const scratchDisplacement = new Cartesian3();
const scratchNorth = new Cartesian3();
const scratchEast = new Cartesian3();
const scratchVelocity = new Cartesian3();
const scratchSphere = new BoundingSphere(new Cartesian3(), 100); // 100m radius roughly
const scratchNorthPole = new Cartesian3(0, 0, 1);
const scratchSurfaceNormal = new Cartesian3();

/**
 * Creates the per-frame update function for entity position extrapolation,
 * horizon culling, frustum culling, and highlight styling.
 */
export function createUpdateLoop(
    viewer: CesiumViewer,
    animatables: AnimatableItem[],
    hoveredEntityIdRef: React.MutableRefObject<string | null>
): () => void {
    let frameCount = 0;

    // We instantiate a reusable culling volume object
    let cullingVolume = new CullingVolume();

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

        // Extract camera culling volume for this frame
        cullingVolume = cam.frustum.computeCullingVolume(cam.positionWC, cam.directionWC, cam.upWC);

        for (let i = 0; i < animatables.length; i++) {
            const item = animatables[i];
            const { primitive, labelPrimitive, entity, posRef } = item;
            const isSelected = state.selectedEntity?.id === entity.id;
            const isHovered = hoveredEntityIdRef.current === entity.id;

            // 1. Frustum Culling
            scratchSphere.center = posRef;
            // Let's use 1000 for visibility padding, roughly fits billboards
            scratchSphere.radius = 1000;
            const intersect = cullingVolume.computeVisibility(scratchSphere);
            const inFrustum = intersect !== Intersect.OUTSIDE;

            // If it's completely out of the camera's view and not selected, skip all heavy JS processing
            if (!inFrustum && !isSelected && !isHovered) {
                primitive.show = false;
                if (labelPrimitive) labelPrimitive.show = false;
                continue;
            }

            // 2. Horizon culling
            const posDistSqr = Cartesian3.magnitudeSquared(posRef);
            const Dph = Math.sqrt(Math.max(0, posDistSqr - R2));
            const distanceToPoint = Cartesian3.distance(camPos, posRef);
            const isVisible = distanceToPoint <= (Dh + Dph);

            if (!isVisible && !isSelected && !isHovered) {
                primitive.show = false;
                if (labelPrimitive) labelPrimitive.show = false;
                continue;
            }

            primitive.show = true;

            // 3. Position extrapolation (Zero-Allocation)
            if (entity.timestamp && entity.speed !== undefined && entity.heading !== undefined) {
                if (isFullUpdate || isSelected || isHovered) {
                    extrapolatePosition(item, nowMs);
                }
            }

            // 4. Highlight styling
            applyHighlight(item, isSelected, isHovered);

            // 5. Label visibility
            if (labelPrimitive) {
                const showLabel = isVisible && (distanceToPoint < 500000 || isSelected || isHovered);
                labelPrimitive.show = showLabel;
                labelPrimitive.fillColor = isSelected ? Color.fromCssColorString("#00fff7") : Color.WHITE;
            }
        }
    };
}

/** Extrapolate entity position forward/backward in time using zero-allocation mathematics. */
function extrapolatePosition(item: AnimatableItem, nowMs: number): void {
    const { entity, posRef } = item;
    if (!entity.timestamp) return;

    const dtSec = (nowMs - entity.timestamp.getTime()) / 1000;
    if (Math.abs(dtSec) > 300) return;

    // Cache base position and velocity vector only once
    if (!item.velocityVector) {
        const headingRad = CesiumMath.toRadians(entity.heading!);
        // Use scratchSurfaceNormal to avoid allocation
        Ellipsoid.WGS84.geodeticSurfaceNormal(posRef, scratchSurfaceNormal);

        Cartesian3.cross(scratchNorthPole, scratchSurfaceNormal, scratchNorth);
        Cartesian3.cross(scratchSurfaceNormal, scratchNorth, scratchNorth);
        Cartesian3.normalize(scratchNorth, scratchNorth);

        Cartesian3.cross(scratchNorth, scratchSurfaceNormal, scratchEast);
        Cartesian3.normalize(scratchEast, scratchEast);

        Cartesian3.multiplyByScalar(scratchNorth, Math.cos(headingRad), scratchVelocity);

        Cartesian3.multiplyByScalar(scratchEast, Math.sin(headingRad), scratchEast); // reuse scratchEast as tempEast
        Cartesian3.add(scratchVelocity, scratchEast, scratchVelocity);
        Cartesian3.multiplyByScalar(scratchVelocity, entity.speed!, scratchVelocity);

        item.basePosition = Cartesian3.clone(posRef);
        item.velocityVector = Cartesian3.clone(scratchVelocity);
    }

    // Apply zero-allocation displacement calculation
    Cartesian3.multiplyByScalar(item.velocityVector, dtSec, scratchDisplacement);
    Cartesian3.add(item.basePosition!, scratchDisplacement, posRef);

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

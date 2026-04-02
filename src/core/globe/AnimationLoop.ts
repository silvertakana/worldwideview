import { Cartesian3, Color, Ellipsoid } from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import { useStore } from "@/core/state/store";
import { createLabel, removeLabel, type AnimatableItem } from "./EntityRenderer";
import { tickStackAnimation } from "./stackAnimation";
import { updateModelTransform } from "./ModelManager";
import { isAnyStackExpanded, isEntityInExpandedStack, getEntityTargetPosition } from "./StackManager";
import {
    HIGHLIGHT_COLOR_SELECTED,
    extrapolatePosition,
    applyHighlight,
} from "./animationHelpers";

const R_WGS84_MIN = 6356752.0;
const R2 = R_WGS84_MIN * R_WGS84_MIN;

/** Interval (in frames) between horizon-culling passes for static entities. */
const STATIC_HORIZON_INTERVAL = 30;

// ── DOD: Pre-sorted entity buckets ──────────────────────────
interface AnimationBuckets {
    dynamic: AnimatableItem[];
    staticBatch: AnimatableItem[];
}

let cachedBuckets: AnimationBuckets = { dynamic: [], staticBatch: [] };
let bucketSourceRef: AnimatableItem[] = [];

/** Rebuild buckets when the animatables array identity changes. */
function ensureBuckets(animatables: AnimatableItem[]): AnimationBuckets {
    if (animatables === bucketSourceRef && (cachedBuckets.dynamic.length + cachedBuckets.staticBatch.length > 0)) {
        return cachedBuckets;
    }
    bucketSourceRef = animatables;
    const dynamic: AnimatableItem[] = [];
    const staticBatch: AnimatableItem[] = [];
    for (let i = 0; i < animatables.length; i++) {
        const speed = animatables[i].entity.speed;
        (speed !== undefined && speed > 0) ? dynamic.push(animatables[i]) : staticBatch.push(animatables[i]);
    }
    cachedBuckets = { dynamic, staticBatch };
    return cachedBuckets;
}

/**
 * Creates the per-frame update function.
 * DOD: Entities are split into dynamic/static buckets so each
 * sub-loop processes homogeneous data without branching on type.
 */
export function createUpdateLoop(
    viewer: CesiumViewer,
    animatablesRef: { current: AnimatableItem[] },
    hoveredEntityIdRef: React.MutableRefObject<string | null>
): () => void {
    let frameCount = 0;
    let prevSelectedId: string | null = null;
    let prevHoveredId: string | null = null;
    let prevAnyExpanded = false;

    return () => {
        if (!viewer || viewer.isDestroyed()) return;
        const animatables = animatablesRef.current;
        const labelsCollection = (viewer as any)._wwvLabels;
        const state = useStore.getState();

        // Always run stack animation tick so that ghost hubs can be cleaned up
        // even if the user toggles all layers off!
        const billboards = (viewer as any)._wwvBillboards;
        let isAnimatingStack = false;
        if (billboards) {
            isAnimatingStack = tickStackAnimation(labelsCollection, billboards);
        }

        if (animatables.length === 0) {
            if (isAnimatingStack || state.isPlaybackMode) viewer.scene.requestRender();
            return;
        }

        const nowMs = state.isPlaybackMode ? state.currentTime.getTime() : Date.now();
        const camPos = viewer.camera.positionWC;
        const camDistSqr = Cartesian3.magnitudeSquared(camPos);
        if (camDistSqr <= R2) return;

        const Dh = Math.sqrt(camDistSqr - R2);
        const frame = frameCount++;
        (window as any)._wwvFrameCount = frame; // Expose globally for throttling
        const isStaticCullFrame = frame % STATIC_HORIZON_INTERVAL === 0;
        const selectedId = state.selectedEntity?.id ?? null;
        const hoveredId = hoveredEntityIdRef.current;
        const anyExpanded = isAnyStackExpanded();

        let forceFullPass = false;
        if (anyExpanded !== prevAnyExpanded) {
            forceFullPass = true;
            prevAnyExpanded = anyExpanded;
        }

        const { dynamic, staticBatch } = ensureBuckets(animatables);

        // Pass 1: Dynamic entities — every frame
        for (let i = 0; i < dynamic.length; i++) {
            const isFaded = anyExpanded && !isEntityInExpandedStack(dynamic[i].entity.id);
            processEntity(dynamic[i], camPos, Dh, nowMs, selectedId, hoveredId, labelsCollection, true, i, isFaded);
        }

        // Pass 2: Static entities — cull frames only (unless interactive)
        if (isStaticCullFrame || forceFullPass) {
            for (let i = 0; i < staticBatch.length; i++) {
                const isFaded = anyExpanded && !isEntityInExpandedStack(staticBatch[i].entity.id);
                processEntity(staticBatch[i], camPos, Dh, nowMs, selectedId, hoveredId, labelsCollection, false, i, isFaded);
            }
        } else {
            for (let i = 0; i < staticBatch.length; i++) {
                const id = staticBatch[i].entity.id;
                if (id === selectedId || id === hoveredId || id === prevSelectedId || id === prevHoveredId) {
                    const isFaded = anyExpanded && !isEntityInExpandedStack(id);
                    processEntity(staticBatch[i], camPos, Dh, nowMs, selectedId, hoveredId, labelsCollection, false, i, isFaded);
                }
            }
        }

        prevSelectedId = selectedId;
        prevHoveredId = hoveredId;

        if (isAnimatingStack || dynamic.length > 0 || state.isPlaybackMode) {
            viewer.scene.requestRender();
        }
    };
}

/** Process a single entity (shared by both dynamic and static passes). */
function processEntity(
    item: AnimatableItem, camPos: Cartesian3, Dh: number, nowMs: number,
    selectedId: string | null, hoveredId: string | null, labelsCollection: any, isDynamic: boolean,
    entityIndex: number, isFaded: boolean
): void {
    const { primitive, entity, posRef } = item;
    if (!primitive || primitive.isDestroyed?.()) return;

    const isSelected = selectedId === entity.id;
    const isHovered = hoveredId === entity.id;

    if (isDynamic && entity.timestamp && entity.heading !== undefined) {
        extrapolatePosition(item, nowMs);
        if (item.options.type === "model") updateModelTransform(item, item.posRef, entity.heading);
        if (item.polylinePrimitive && item.trailPositions && item.trailPositions.length > 0) {
            item.trailPositions[item.trailPositions.length - 1] = item.posRef;
            item.polylinePrimitive.positions = item.trailPositions;
        }
    }

    if (item._modelPromoted) return;

    // Mathematical horizon culling (extremely fast, precise for sphere)
    item._occluded = Cartesian3.dot(posRef, camPos) <= R2;
    if (item._occluded) {
        if (primitive.show !== false) primitive.show = false;
        hideLabel(item, labelsCollection);
        return;
    }

    // Force rendering pos to hub if clustered, so pixelOffset originates from the hub
    const targetPos = getEntityTargetPosition(entity.id) ?? posRef;
    if (primitive.position && !Cartesian3.equals(primitive.position, targetPos)) {
        primitive.position = targetPos;
        if (item.labelPrimitive && !item.labelPrimitive.isDestroyed?.()) {
            item.labelPrimitive.position = targetPos;
        }
    }

    if (primitive.show !== true) primitive.show = true;

    // Highlight styling
    if (item.options.type !== "model") {
        applyHighlight(item, isSelected, isHovered, isFaded);
    } else {
        if (isSelected && primitive.silhouetteSize !== 2) primitive.silhouetteSize = 2;
        else if (isHovered && primitive.silhouetteSize !== 1) primitive.silhouetteSize = 1;
        else if (!isSelected && !isHovered && primitive.silhouetteSize !== 0) primitive.silhouetteSize = 0;
    }

    // Label visibility naturally triggers ONLY on hover or select to bypass text buffer lag
    const showLabel = isSelected || isHovered;
    if (showLabel) {
        if (!item.labelPrimitive && labelsCollection) createLabel(item, labelsCollection);
        if (item.labelPrimitive && !item.labelPrimitive.isDestroyed?.()) {
            if (item.labelPrimitive.show !== true) item.labelPrimitive.show = true;
            const fill = isSelected ? HIGHLIGHT_COLOR_SELECTED : Color.WHITE;
            if (!Color.equals(item.labelPrimitive.fillColor, fill)) item.labelPrimitive.fillColor = fill;
        }
    } else {
        hideLabel(item, labelsCollection);
    }
}

/** Hide label to save render time, but do NOT remove it. Creating/Removing labels triggers massive WebGL buffer rewrites. */
function hideLabel(item: AnimatableItem, labelsCollection: any): void {
    if (!item.labelPrimitive || item.labelPrimitive.isDestroyed?.()) return;
    if (item.labelPrimitive.show !== false) item.labelPrimitive.show = false;
    // We intentionally do NOT call removeLabel here. Let Cesium use the 'show' boolean 
    // to skip rendering, which is O(1). 
}

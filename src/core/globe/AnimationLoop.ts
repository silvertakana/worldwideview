import { Cartesian3, Color, Ellipsoid } from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import { useStore } from "@/core/state/store";
import { createLabel, removeLabel, type AnimatableItem } from "./EntityRenderer";
import { tickStackAnimation } from "./stackAnimation";
import { updateModelTransform } from "./ModelManager";
import { isAnyStackExpanded, isEntityInExpandedStack, getEntityTargetPosition, isEntityClustered, getStackStateVersion } from "./StackManager";
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
    let prevStackVersion = -1;

    let lastPerfTime = performance.now();
    let smoothedSimMs = Date.now();
    let lastStoreUpdatePerf = lastPerfTime;
    let performanceOrigin = Date.now() - lastPerfTime;

    return () => {
        if (!viewer || viewer.isDestroyed()) return;

        const state = useStore.getState();
        const nowPerf = performance.now();
        const deltaPerf = nowPerf - lastPerfTime;
        lastPerfTime = nowPerf;
        
        let nowMs: number;
        if (state.isPlaybackMode) {
            const storeTimeMs = state.currentTime.getTime();
            
            // If the store time jumped (user scrubbing) or we lost sync:
            if (Math.abs(smoothedSimMs - storeTimeMs) > 100) {
                smoothedSimMs = storeTimeMs;
            } else if (state.isPlaying) {
                smoothedSimMs += deltaPerf * state.playbackSpeed;
                
                if (smoothedSimMs >= state.timeRange.end.getTime()) {
                    smoothedSimMs = state.timeRange.end.getTime();
                    state.setPlaying(false);
                }
            }
            nowMs = smoothedSimMs;
            
            // Throttle store updates to ~15fps (66ms) so React UI re-renders don't overload CPU
            if (state.isPlaying && (nowPerf - lastStoreUpdatePerf > 66)) {
                lastStoreUpdatePerf = nowPerf;
                state.setCurrentTime(new Date(smoothedSimMs));
            }
        } else {
            // Protect against Date.now() 15ms coarse OS resolution jitter!
            // We use high-res continuous timeline mapping, but re-anchor 
            // if the system clock drifts significantly over long standby periods.
            const systemNow = Date.now();
            const perfNowUnix = performanceOrigin + nowPerf;
            if (Math.abs(systemNow - perfNowUnix) > 50) {
                performanceOrigin = systemNow - nowPerf;
            }
            nowMs = performanceOrigin + nowPerf;
            smoothedSimMs = nowMs;
        }

        const animatables = animatablesRef.current;
        const labelsCollection = (viewer as any)._wwvLabels;

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
        
        const currentStackVersion = getStackStateVersion();
        if (currentStackVersion !== prevStackVersion) {
            forceFullPass = true;
            prevStackVersion = currentStackVersion;
        }

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
        // Do NOT re-assign item.polylinePrimitive.positions here at 60fps.
        // It triggers a massive synchronous WebGL vertex buffer rewrite in Cesium.
        // This is handled at 4Hz in useTrailRendering.ts instead.
    }

    const showLabel = isSelected || isHovered;

    const applyLabel = () => {
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
    };

    if (item._modelPromoted) {
        if (item.promotedModel && !item.promotedModel.isDestroyed?.()) {
            if (isSelected && item.promotedModel.silhouetteSize !== 2) item.promotedModel.silhouetteSize = 2;
            else if (isHovered && item.promotedModel.silhouetteSize !== 1) item.promotedModel.silhouetteSize = 1;
            else if (!isSelected && !isHovered && item.promotedModel.silhouetteSize !== 0) item.promotedModel.silhouetteSize = 0;
        }
        applyLabel();
        return;
    }

    if (!item.options.disableManualHorizonCulling || primitive.disableDepthTestDistance === Number.POSITIVE_INFINITY) {
        // Mathematical horizon culling (extremely fast, precise for sphere)
        item._occluded = Cartesian3.dot(posRef, camPos) <= R2;
        if (item._occluded) {
            if (primitive.show !== false) primitive.show = false;
            hideLabel(item, labelsCollection);
            return;
        }
    }

    // Force rendering pos to hub if clustered, so pixelOffset originates from the hub
    const targetPos = getEntityTargetPosition(entity.id) ?? posRef;
    if (primitive.position && !Cartesian3.equals(primitive.position, targetPos)) {
        primitive.position = targetPos;
        if (item.labelPrimitive && !item.labelPrimitive.isDestroyed?.()) {
            item.labelPrimitive.position = targetPos;
        }
    }

    // Delegate visibility to stackAnimation if the entity is clustered
    // This prevents the data points from flickering over the cluster badge.
    if (!isEntityClustered(entity.id) && primitive.show !== true) {
        primitive.show = true;
    }

    // Highlight styling handles fallback billboard vs point directly inside applyHighlight
    applyHighlight(item, isSelected, isHovered, isFaded);

    applyLabel();
}

/** Hide label to save render time, but do NOT remove it. Creating/Removing labels triggers massive WebGL buffer rewrites. */
function hideLabel(item: AnimatableItem, labelsCollection: any): void {
    if (!item.labelPrimitive || item.labelPrimitive.isDestroyed?.()) return;
    if (item.labelPrimitive.show !== false) item.labelPrimitive.show = false;
    // We intentionally do NOT call removeLabel here. Let Cesium use the 'show' boolean 
    // to skip rendering, which is O(1). 
}

import {
    Cartesian3, Cartographic, Color, Ellipsoid,
    PointPrimitiveCollection, BillboardCollection, LabelCollection, PolylineCollection,
    VerticalOrigin, DistanceDisplayCondition, NearFarScalar, HeightReference,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";
import { globalChunkedProcessor } from "./ChunkedProcessor";
import {
    scratchPosition, getEntityColor, getCachedColor,
    markAnimatablesDirty, getStableAnimatables,
} from "./renderCaches";
import { updateExistingItem, createNewItem, cleanupRemovedEntities, getDefaultDotIcon } from "./primitiveOps";
import { rebuildStacks, calculateGridSizeDegrees } from "./StackManager";

// Re-export for existing consumers
export { getEntityColor, getCachedColor, markAnimatablesDirty, getStableAnimatables } from "./renderCaches";

export interface AnimatableItem {
    primitive: any;
    labelPrimitive?: any;
    entity: GeoEntity;
    posRef: Cartesian3;
    options: CesiumEntityOptions;
    basePosition?: Cartesian3;
    velocityVector?: Cartesian3;
    baseColor?: Color;
    baseOutlineColor?: Color;
    lastHighlightState?: 'normal' | 'hovered' | 'selected';
    /** Set by LOD hook — when true, billboard is hidden because a 3D model replaced it */
    _modelPromoted?: boolean;
    /** Set by AnimationLoop - true if hidden by mathematical horizon culling */
    _occluded?: boolean;
    polylinePrimitive?: any;      // Reference to the trail polyline in the collection
    trailPositions?: Cartesian3[]; // Cached position array to avoid GC pressure
    _lastHistoryTs?: number;     // Timestamp of the latest history point processed
}

/** Global render kickstarter for deeply nested async operations. */
export let globalRequestRender: () => void = () => { };

/** Initialize primitive collections on the viewer. */
export function initPrimitiveCollections(viewer: CesiumViewer): void {
    if (!viewer?.scene?.primitives) {
        console.warn("[EntityRenderer] initPrimitiveCollections called before viewer.scene was ready — skipping.");
        return;
    }
    (viewer as any)._wwvPoints = viewer.scene.primitives.add(new PointPrimitiveCollection());
    const billboards = new BillboardCollection({ scene: viewer.scene });
    billboards.blendOption = 2; // TRANSLUCENT
    (viewer as any)._wwvBillboards = viewer.scene.primitives.add(billboards);
    (viewer as any)._wwvLabels = viewer.scene.primitives.add(new LabelCollection({ scene: viewer.scene }));
    (viewer as any)._wwvPolylines = viewer.scene.primitives.add(new PolylineCollection());

    globalRequestRender = () => {
        if (viewer && !viewer.isDestroyed()) {
            viewer.scene.requestRender();
        }
    };
}

/** Get typed references to the primitive collections. */
export function getCollections(viewer: CesiumViewer) {
    return {
        points: (viewer as any)._wwvPoints as PointPrimitiveCollection,
        billboards: (viewer as any)._wwvBillboards as BillboardCollection,
        labels: (viewer as any)._wwvLabels as LabelCollection,
        polylines: (viewer as any)._wwvPolylines as PolylineCollection,
    };
}

/** Creates a label primitive for an item (lazy evaluation). */
export function createLabel(item: AnimatableItem, labels: LabelCollection): void {
    if (!item.options.labelText || item.labelPrimitive) return;
    const clickId = { _wwvEntity: item.entity };
    item.labelPrimitive = labels.add({
        position: item.posRef,
        text: item.options.labelText,
        font: item.options.labelFont || "12px Inter, sans-serif",
        fillColor: Color.WHITE, outlineColor: Color.BLACK, outlineWidth: 2,
        verticalOrigin: VerticalOrigin.BOTTOM, pixelOffset: { x: 0, y: -12 } as any,
        show: true, id: clickId,
        // WARNING: Do NOT use heightReference: HeightReference.CLAMP_TO_GROUND here.
        // It causes severe lag/performance drops with thousands of dynamic entities.
        disableDepthTestDistance: item.options.disableDepthTestDistance ?? Number.POSITIVE_INFINITY,
        translucencyByDistance: new NearFarScalar(1e3, 1.0, 5e5, 0.0),
        distanceDisplayCondition: item.options.distanceDisplayCondition
            ? new DistanceDisplayCondition(item.options.distanceDisplayCondition.near, item.options.distanceDisplayCondition.far)
            : undefined,
    });
}

/** Removes a label primitive for an item. */
export function removeLabel(item: AnimatableItem, labels: LabelCollection): void {
    if (!item.labelPrimitive) return;
    labels.remove(item.labelPrimitive);
    item.labelPrimitive = undefined;
}

/** Core rendering logic for a single entity. */
function renderSingleEntity(
    { entity, options }: { entity: GeoEntity; options: CesiumEntityOptions },
    existingMap: Map<string, AnimatableItem>,
    points: PointPrimitiveCollection, billboards: BillboardCollection,
    labels: LabelCollection, currentIds: Set<string>
) {
    currentIds.add(entity.id);
    Cartesian3.fromDegrees(entity.longitude, entity.latitude, entity.altitude || 0, Ellipsoid.WGS84, scratchPosition);
    
    // Auto-upgrade missing icons to SVG Billboards so pixelOffsets (spiderifier) will work
    const effectiveOptions = { ...options };
    const baseColor = getEntityColor(effectiveOptions);
    if (!effectiveOptions.iconUrl && effectiveOptions.type !== "model") {
        const baseOutlineColor = getCachedColor(options.outlineColor) || Color.BLACK;
        const outWidth = options.outlineWidth || 1;
        const pSize = options.size || (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches ? 12 : 8);
        effectiveOptions.iconUrl = getDefaultDotIcon(baseColor, baseOutlineColor, outWidth, pSize);
        effectiveOptions.iconScale = 1.0;
        (effectiveOptions as any)._isAutoSVG = true;
    }
    
    const clickId = { _wwvEntity: entity };
    let item = existingMap.get(entity.id);

    if (item && item.options.type !== effectiveOptions.type) {
        if (item.options.iconUrl) billboards.remove(item.primitive); else points.remove(item.primitive);
        if (item.labelPrimitive) labels.remove(item.labelPrimitive);
        existingMap.delete(entity.id);
        item = undefined;
    }

    if (item) {
        updateExistingItem(item, entity, effectiveOptions, baseColor);
    } else {
        createNewItem(entity, effectiveOptions, baseColor, clickId, existingMap, points, billboards);
    }
}

/** Chunked rendering for large datasets (10k+). */
export async function renderEntitiesChunked(
    viewer: CesiumViewer,
    visibleEntities: Array<{ entity: GeoEntity; options: CesiumEntityOptions }>,
    existingMap: Map<string, AnimatableItem>,
    onChunkProcessed?: () => void
): Promise<AnimatableItem[]> {
    const { points, billboards, labels, polylines } = getCollections(viewer);
    if (!points || !billboards || !labels) return getStableAnimatables(existingMap);
    const currentIds = new Set<string>();
    const completed = await globalChunkedProcessor.processChunked(visibleEntities, 500, (chunk) => {
        if (viewer.isDestroyed()) return;
        for (let i = 0; i < chunk.length; i++) renderSingleEntity(chunk[i], existingMap, points, billboards, labels, currentIds);
        if (onChunkProcessed) onChunkProcessed();
    });

    if (!completed || viewer.isDestroyed()) {
        return getStableAnimatables(existingMap);
    }

    cleanupRemovedEntities(existingMap, currentIds, points, billboards, labels, polylines);
    markAnimatablesDirty();

    let altitude = 1000000;
    if (viewer.camera && viewer.camera.positionCartographic) {
        altitude = viewer.camera.positionCartographic.height;
    } else if (viewer.camera && viewer.camera.position) {
        const carto = Cartographic.fromCartesian(viewer.camera.position);
        if (carto) altitude = carto.height;
    }

    rebuildStacks(existingMap, calculateGridSizeDegrees(altitude), true);
    return getStableAnimatables(existingMap);
}

/** Synchronous render for smaller datasets or instant updates. */
export function renderEntities(
    viewer: CesiumViewer,
    visibleEntities: Array<{ entity: GeoEntity; options: CesiumEntityOptions }>,
    existingMap: Map<string, AnimatableItem>
): AnimatableItem[] {
    globalChunkedProcessor.cancel();
    const { points, billboards, labels, polylines } = getCollections(viewer);
    if (!points || !billboards || !labels) return getStableAnimatables(existingMap);
    const currentIds = new Set<string>();
    for (const item of visibleEntities) renderSingleEntity(item, existingMap, points, billboards, labels, currentIds);
    cleanupRemovedEntities(existingMap, currentIds, points, billboards, labels, polylines);
    markAnimatablesDirty();

    let altitude = 1000000;
    if (viewer.camera && viewer.camera.positionCartographic) {
        altitude = viewer.camera.positionCartographic.height;
    } else if (viewer.camera && viewer.camera.position) {
        const carto = Cartographic.fromCartesian(viewer.camera.position);
        if (carto) altitude = carto.height;
    }

    rebuildStacks(existingMap, calculateGridSizeDegrees(altitude), true);
    return getStableAnimatables(existingMap);
}

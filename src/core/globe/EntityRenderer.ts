import {
    Cartesian3, Color, Ellipsoid,
    PointPrimitiveCollection, BillboardCollection, LabelCollection,
    VerticalOrigin, DistanceDisplayCondition, NearFarScalar,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";
import { globalChunkedProcessor } from "./ChunkedProcessor";
import {
    scratchPosition, getEntityColor,
    markAnimatablesDirty, getStableAnimatables,
} from "./renderCaches";
import { updateExistingItem, createNewItem, cleanupRemovedEntities } from "./primitiveOps";

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
}

/** Initialize primitive collections on the viewer. */
export function initPrimitiveCollections(viewer: CesiumViewer): void {
    (viewer as any)._wwvPoints = viewer.scene.primitives.add(new PointPrimitiveCollection());
    const billboards = new BillboardCollection();
    billboards.blendOption = 2; // TRANSLUCENT
    (viewer as any)._wwvBillboards = viewer.scene.primitives.add(billboards);
    (viewer as any)._wwvLabels = viewer.scene.primitives.add(new LabelCollection());
}

/** Get typed references to the primitive collections. */
export function getCollections(viewer: CesiumViewer) {
    return {
        points: (viewer as any)._wwvPoints as PointPrimitiveCollection,
        billboards: (viewer as any)._wwvBillboards as BillboardCollection,
        labels: (viewer as any)._wwvLabels as LabelCollection,
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
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
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
    const color = getEntityColor(options);
    const clickId = { _wwvEntity: entity };
    let item = existingMap.get(entity.id);

    if (item && item.options.type !== options.type) {
        if (item.options.iconUrl) billboards.remove(item.primitive); else points.remove(item.primitive);
        if (item.labelPrimitive) labels.remove(item.labelPrimitive);
        existingMap.delete(entity.id);
        item = undefined;
    }

    if (item) {
        updateExistingItem(item, entity, options, color);
    } else {
        createNewItem(entity, options, color, clickId, existingMap, points, billboards);
    }
}

/** Chunked rendering for large datasets (10k+). */
export async function renderEntitiesChunked(
    viewer: CesiumViewer,
    visibleEntities: Array<{ entity: GeoEntity; options: CesiumEntityOptions }>,
    existingMap: Map<string, AnimatableItem>
): Promise<AnimatableItem[]> {
    const { points, billboards, labels } = getCollections(viewer);
    if (!points || !billboards || !labels) return getStableAnimatables(existingMap);
    const currentIds = new Set<string>();
    await globalChunkedProcessor.processChunked(visibleEntities, 1000, (chunk) => {
        if (viewer.isDestroyed()) return;
        for (let i = 0; i < chunk.length; i++) renderSingleEntity(chunk[i], existingMap, points, billboards, labels, currentIds);
    });
    cleanupRemovedEntities(existingMap, currentIds, points, billboards, labels);
    markAnimatablesDirty();
    return getStableAnimatables(existingMap);
}

/** Synchronous render for smaller datasets or instant updates. */
export function renderEntities(
    viewer: CesiumViewer,
    visibleEntities: Array<{ entity: GeoEntity; options: CesiumEntityOptions }>,
    existingMap: Map<string, AnimatableItem>
): AnimatableItem[] {
    globalChunkedProcessor.cancel();
    const { points, billboards, labels } = getCollections(viewer);
    if (!points || !billboards || !labels) return getStableAnimatables(existingMap);
    const currentIds = new Set<string>();
    for (const item of visibleEntities) renderSingleEntity(item, existingMap, points, billboards, labels, currentIds);
    cleanupRemovedEntities(existingMap, currentIds, points, billboards, labels);
    markAnimatablesDirty();
    return getStableAnimatables(existingMap);
}

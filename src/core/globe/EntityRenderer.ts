import {
    Cartesian3,
    Color,
    NearFarScalar,
    VerticalOrigin,
    HorizontalOrigin,
    Math as CesiumMath,
    Ellipsoid,
    BoundingSphere,
    PointPrimitiveCollection,
    BillboardCollection,
    LabelCollection,
    DistanceDisplayCondition,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";
import { useStore } from "@/core/state/store";

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

/**
 * Resolve entity color from options, defaulting to cyan.
 */
export function getEntityColor(options: CesiumEntityOptions): Color {
    return options.color ? Color.fromCssColorString(options.color) : Color.CYAN;
}

/**
 * Initialize primitive collections on the viewer.
 */
export function initPrimitiveCollections(viewer: CesiumViewer): void {
    (viewer as any)._wwvPoints = viewer.scene.primitives.add(new PointPrimitiveCollection());

    // Phase 3: Optimize billboard blend mode since most icons use alpha transparency
    const billboards = new BillboardCollection();
    billboards.blendOption = 0; // BlendOption.OPAQUE_AND_TRANSLUCENT (Cesium default requires 2-pass)
    // Actually Cesium's BlendOption is defined in the enum: OPAQUE=1, TRANSLUCENT=2, OPAQUE_AND_TRANSLUCENT=0
    // We'll use TRANSLUCENT (2) to avoid the 2-pass render since all our markers use RGBA
    billboards.blendOption = 2; // TRANSLUCENT
    (viewer as any)._wwvBillboards = viewer.scene.primitives.add(billboards);

    (viewer as any)._wwvLabels = viewer.scene.primitives.add(new LabelCollection());
}

/**
 * Get typed references to the primitive collections.
 */
export function getCollections(viewer: CesiumViewer) {
    return {
        points: (viewer as any)._wwvPoints as PointPrimitiveCollection,
        billboards: (viewer as any)._wwvBillboards as BillboardCollection,
        labels: (viewer as any)._wwvLabels as LabelCollection,
    };
}

/**
 * Creates a label primitive for an item (Lazy evaluation).
 */
export function createLabel(item: AnimatableItem, labels: LabelCollection): void {
    if (!item.options.labelText || item.labelPrimitive) return;

    // Only fetch the collection if valid
    const clickId = { _wwvEntity: item.entity };
    item.labelPrimitive = labels.add({
        position: item.posRef,
        text: item.options.labelText,
        font: item.options.labelFont || "12px Inter, sans-serif",
        fillColor: Color.WHITE, outlineColor: Color.BLACK, outlineWidth: 2,
        verticalOrigin: VerticalOrigin.BOTTOM, pixelOffset: { x: 0, y: -12 } as any,
        show: true, id: clickId,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        distanceDisplayCondition: item.options.distanceDisplayCondition
            ? new DistanceDisplayCondition(item.options.distanceDisplayCondition.near, item.options.distanceDisplayCondition.far)
            : undefined,
    });
}

/**
 * Removes a label primitive for an item.
 */
export function removeLabel(item: AnimatableItem, labels: LabelCollection): void {
    if (!item.labelPrimitive) return;
    labels.remove(item.labelPrimitive);
    item.labelPrimitive = undefined;
}

import { globalChunkedProcessor } from "./ChunkedProcessor";

/**
 * Core rendering logic for a single entity, extracted from loop for reuse
 */
function renderSingleEntity(
    { entity, options }: { entity: GeoEntity; options: CesiumEntityOptions },
    existingMap: Map<string, AnimatableItem>,
    points: PointPrimitiveCollection,
    billboards: BillboardCollection,
    labels: LabelCollection,
    currentIds: Set<string>
) {
    currentIds.add(entity.id);
    const position = Cartesian3.fromDegrees(entity.longitude, entity.latitude, entity.altitude || 0);
    const color = getEntityColor(options);
    const clickId = { _wwvEntity: entity };

    let item = existingMap.get(entity.id);

    if (item && item.options.type !== options.type) {
        // Re-create if type changed
        if (item.options.iconUrl) {
            billboards.remove(item.primitive);
        } else {
            points.remove(item.primitive);
        }
        if (item.labelPrimitive) {
            labels.remove(item.labelPrimitive);
        }
        existingMap.delete(entity.id);
        item = undefined;
    }

    if (item) {
        // Update existing
        item.entity = entity;
        item.options = options;
        item.posRef = position;
        item.basePosition = undefined;
        item.velocityVector = undefined;
        item.baseColor = color;
        item.baseOutlineColor = options.outlineColor ? Color.fromCssColorString(options.outlineColor) : Color.BLACK;

        if (!Color.equals(item.primitive.color, color)) item.primitive.color = color;
        if (!Cartesian3.equals(item.primitive.position, position)) item.primitive.position = position;

        if (options.iconUrl) {
            if (item.primitive.image !== options.iconUrl) item.primitive.image = options.iconUrl;
            const rot = options.rotation ? -CesiumMath.toRadians(options.rotation) : 0;
            if (item.primitive.rotation !== rot) item.primitive.rotation = rot;
        } else {
            const newSize = options.size || 6;
            const newOutlineWidth = options.outlineWidth || 1;

            if (item.primitive.pixelSize !== newSize) item.primitive.pixelSize = newSize;
            if (!Color.equals(item.primitive.outlineColor, item.baseOutlineColor)) item.primitive.outlineColor = item.baseOutlineColor;
            if (item.primitive.outlineWidth !== newOutlineWidth) item.primitive.outlineWidth = newOutlineWidth;
        }
    } else {
        let addedPrimitive: any;
        if (options.iconUrl) {
            addedPrimitive = billboards.add({
                position, image: options.iconUrl, scale: 0.5,
                verticalOrigin: VerticalOrigin.CENTER, horizontalOrigin: HorizontalOrigin.CENTER,
                rotation: options.rotation ? -CesiumMath.toRadians(options.rotation) : 0,
                color, scaleByDistance: new NearFarScalar(1e3, 1.0, 1e7, 0.3), id: clickId,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                distanceDisplayCondition: options.distanceDisplayCondition ? new DistanceDisplayCondition(options.distanceDisplayCondition.near, options.distanceDisplayCondition.far) : undefined,
            });
        } else {
            addedPrimitive = points.add({
                position, pixelSize: options.size || 6, color,
                outlineColor: options.outlineColor ? Color.fromCssColorString(options.outlineColor) : Color.BLACK,
                outlineWidth: options.outlineWidth || 1,
                scaleByDistance: new NearFarScalar(1e3, 1.0, 1e7, 0.4), id: clickId,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                distanceDisplayCondition: options.distanceDisplayCondition ? new DistanceDisplayCondition(options.distanceDisplayCondition.near, options.distanceDisplayCondition.far) : undefined,
            });
        }

        item = {
            primitive: addedPrimitive,
            labelPrimitive: undefined, // Lazy
            entity,
            posRef: position,
            options,
            baseColor: color,
            baseOutlineColor: options.outlineColor ? Color.fromCssColorString(options.outlineColor) : Color.BLACK,
            lastHighlightState: 'normal'
        };
        existingMap.set(entity.id, item);
    }
}

/**
 * Cleanup primitives for entities that are no longer in visibleEntities
 */
function cleanupRemovedEntities(
    existingMap: Map<string, AnimatableItem>,
    currentIds: Set<string>,
    points: PointPrimitiveCollection,
    billboards: BillboardCollection,
    labels: LabelCollection
) {
    for (const [id, item] of existingMap.entries()) {
        if (!currentIds.has(id)) {
            if (item.options.iconUrl) {
                billboards.remove(item.primitive);
            } else {
                points.remove(item.primitive);
            }
            if (item.labelPrimitive) {
                labels.remove(item.labelPrimitive);
            }
            existingMap.delete(id);
        }
    }
}

/**
 * Chunked rendering of entities to prevent main thread blocking for large datasets (e.g., 10k+)
 */
export async function renderEntitiesChunked(
    viewer: CesiumViewer,
    visibleEntities: Array<{ entity: GeoEntity; options: CesiumEntityOptions }>,
    existingMap: Map<string, AnimatableItem>
): Promise<AnimatableItem[]> {
    const { points, billboards, labels } = getCollections(viewer);
    if (!points || !billboards || !labels) return Array.from(existingMap.values());

    const currentIds = new Set<string>();

    await globalChunkedProcessor.processChunked(
        visibleEntities,
        500, // Process 500 items per chunk
        (chunk) => {
            if (viewer.isDestroyed()) return;
            for (let i = 0; i < chunk.length; i++) {
                renderSingleEntity(chunk[i], existingMap, points, billboards, labels, currentIds);
            }
        }
    );

    cleanupRemovedEntities(existingMap, currentIds, points, billboards, labels);

    return Array.from(existingMap.values());
}

/**
 * Original synchronous render method, useful for smaller datasets or when instant update is required.
 */
export function renderEntities(
    viewer: CesiumViewer,
    visibleEntities: Array<{ entity: GeoEntity; options: CesiumEntityOptions }>,
    existingMap: Map<string, AnimatableItem>
): AnimatableItem[] {
    // Cancel any background async processing if a sync update is forced
    globalChunkedProcessor.cancel();

    const { points, billboards, labels } = getCollections(viewer);
    if (!points || !billboards || !labels) return Array.from(existingMap.values());

    const currentIds = new Set<string>();

    for (const item of visibleEntities) {
        renderSingleEntity(item, existingMap, points, billboards, labels, currentIds);
    }

    cleanupRemovedEntities(existingMap, currentIds, points, billboards, labels);

    return Array.from(existingMap.values());
}

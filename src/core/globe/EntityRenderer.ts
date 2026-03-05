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
    (viewer as any)._wwvBillboards = viewer.scene.primitives.add(new BillboardCollection());
    (viewer as any)._wwvLabels = viewer.scene.primitives.add(new LabelCollection());
}

/**
 * Get typed references to the primitive collections.
 */
function getCollections(viewer: CesiumViewer) {
    return {
        points: (viewer as any)._wwvPoints as PointPrimitiveCollection,
        billboards: (viewer as any)._wwvBillboards as BillboardCollection,
        labels: (viewer as any)._wwvLabels as LabelCollection,
    };
}

/**
 * Populate primitive collections with visible entities.
 * Returns the animatable items array for the update loop.
 */
export function renderEntities(
    viewer: CesiumViewer,
    visibleEntities: Array<{ entity: GeoEntity; options: CesiumEntityOptions }>,
    existingMap: Map<string, AnimatableItem>
): AnimatableItem[] {
    const { points, billboards, labels } = getCollections(viewer);
    if (!points || !billboards || !labels) return [];

    const currentIds = new Set<string>();

    for (const { entity, options } of visibleEntities) {
        currentIds.add(entity.id);
        const position = Cartesian3.fromDegrees(entity.longitude, entity.latitude, entity.altitude || 0);
        const color = getEntityColor(options);
        const clickId = { _wwvEntity: entity };

        let item = existingMap.get(entity.id);

        if (item && item.options.type !== options.type) {
            // Re-create if type changed (e.g. point to billboard)
            if (item.options.type === "billboard" && item.options.iconUrl) {
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

            if (!Color.equals(item.primitive.color, color)) {
                item.primitive.color = color;
            }
            if (!Cartesian3.equals(item.primitive.position, position)) {
                item.primitive.position = position;
            }

            if (options.type === "billboard" && options.iconUrl) {
                if (item.primitive.image !== options.iconUrl) item.primitive.image = options.iconUrl;
                const rot = options.rotation ? -CesiumMath.toRadians(options.rotation) : 0;
                if (item.primitive.rotation !== rot) item.primitive.rotation = rot;
            } else {
                const newSize = options.size || 6;
                const newOutlineWidth = options.outlineWidth || 1;

                if (item.primitive.pixelSize !== newSize) {
                    item.primitive.pixelSize = newSize;
                }
                if (!Color.equals(item.primitive.outlineColor, item.baseOutlineColor)) {
                    item.primitive.outlineColor = item.baseOutlineColor;
                }
                if (item.primitive.outlineWidth !== newOutlineWidth) {
                    item.primitive.outlineWidth = newOutlineWidth;
                }
            }

            if (item.labelPrimitive && options.labelText) {
                if (item.labelPrimitive.text !== options.labelText) item.labelPrimitive.text = options.labelText;
                if (!Cartesian3.equals(item.labelPrimitive.position, position)) {
                    item.labelPrimitive.position = position;
                }
            }
        } else {
            let addedPrimitive: any;
            if (options.type === "billboard" && options.iconUrl) {
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

            let addedLabel: any;
            if (options.labelText) {
                addedLabel = labels.add({
                    position, text: options.labelText, font: options.labelFont || "12px Inter, sans-serif",
                    fillColor: Color.WHITE, outlineColor: Color.BLACK, outlineWidth: 2,
                    verticalOrigin: VerticalOrigin.BOTTOM, pixelOffset: { x: 0, y: -12 } as any,
                    show: false, id: clickId,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    distanceDisplayCondition: options.distanceDisplayCondition ? new DistanceDisplayCondition(options.distanceDisplayCondition.near, options.distanceDisplayCondition.far) : undefined,
                });
            }

            item = {
                primitive: addedPrimitive,
                labelPrimitive: addedLabel,
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

    // Remove primitives for entities no longer visible
    for (const [id, item] of existingMap.entries()) {
        if (!currentIds.has(id)) {
            if (item.options.type === "billboard" && item.options.iconUrl) {
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

    return Array.from(existingMap.values());
}

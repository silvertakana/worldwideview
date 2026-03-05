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

interface AnimatableItem {
    primitive: any;
    labelPrimitive?: any;
    entity: GeoEntity;
    posRef: Cartesian3;
    options: CesiumEntityOptions;
    basePosition?: Cartesian3;
    velocityVector?: Cartesian3;
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
    visibleEntities: Array<{ entity: GeoEntity; options: CesiumEntityOptions }>
): AnimatableItem[] {
    const { points, billboards, labels } = getCollections(viewer);
    if (!points || !billboards || !labels) return [];

    points.removeAll();
    billboards.removeAll();
    labels.removeAll();

    const animatables: AnimatableItem[] = [];

    for (const { entity, options } of visibleEntities) {
        const position = Cartesian3.fromDegrees(entity.longitude, entity.latitude, entity.altitude || 0);
        const color = getEntityColor(options);
        const clickId = { _wwvEntity: entity };

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

        animatables.push({ primitive: addedPrimitive, labelPrimitive: addedLabel, entity, posRef: position, options });
    }

    return animatables;
}

/**
 * DOD: Primitive creation and cleanup helpers for EntityRenderer.
 * Separated from the main renderer to keep individual files under 150 lines.
 */
import {
    Cartesian3,
    Color,
    NearFarScalar,
    VerticalOrigin,
    HorizontalOrigin,
    Math as CesiumMath,
    PointPrimitiveCollection,
    BillboardCollection,
    LabelCollection,
    DistanceDisplayCondition,
    HeightReference,
} from "cesium";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";
import type { AnimatableItem } from "./EntityRenderer";
import { scratchPosition, getCachedColor } from "./renderCaches";
import { globalRequestRender } from "./EntityRenderer";
import { getHiResIconSync, getHiResIcon, getBaseSize } from "./iconUpscaler";

/** Default billboard scale applied when plugin does not specify iconScale. */
const DEFAULT_BILLBOARD_SCALE = 0.7;

/** Returns a touch-friendly default point size: larger on mobile. */
function defaultPointSize(): number {
    if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) return 12;
    return 8;
}

const dotIconCache = new Map<string, string>();

/** Generates a simple circular dot SVG to act as a fallback billboard for points, enabling pixelOffsets. */
export function getDefaultDotIcon(color: Color, outlineColor: Color, outlineWidth: number, size: number): string {
    const colorHash = color.toCssColorString();
    const strokeHash = outlineColor.toCssColorString();
    const key = `${colorHash}_${strokeHash}_${outlineWidth}_${size}`;
    let cached = dotIconCache.get(key);
    if (!cached) {
        const actualSize = size + outlineWidth * 2 + 4;
        const center = actualSize / 2;
        const radius = size / 2;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${actualSize}" height="${actualSize}">
            <circle cx="${center}" cy="${center}" r="${radius}" fill="${colorHash}" stroke="${strokeHash}" stroke-width="${outlineWidth}"/>
        </svg>`;
        cached = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        dotIconCache.set(key, cached);
    }
    return cached;
}

/** Update an existing AnimatableItem with new entity data. */
export function updateExistingItem(
    item: AnimatableItem, entity: GeoEntity, options: CesiumEntityOptions, color: Color
) {
    item.entity = entity;
    item.options = options;
    Cartesian3.clone(scratchPosition, item.posRef);
    item.basePosition = undefined;
    item.velocityVector = undefined;
    item.baseColor = color;
    item.baseOutlineColor = getCachedColor(options.outlineColor) || Color.BLACK;

    const billboardColor = (options as any)._isAutoSVG ? Color.WHITE : color;

    if (!Color.equals(item.primitive.color, billboardColor)) item.primitive.color = billboardColor;
    if (!Cartesian3.equals(item.primitive.position, item.posRef)) item.primitive.position = item.posRef;
    if (options.iconUrl) {
        const baseSize = getBaseSize();
        if (item.primitive.width !== baseSize) item.primitive.width = baseSize;
        if (item.primitive.height !== baseSize) item.primitive.height = baseSize;

        const hiRes = getHiResIconSync(options.iconUrl) ?? options.iconUrl;
        if (item.primitive.image !== hiRes) {
            item.primitive.image = hiRes;
            if (hiRes === options.iconUrl) {
                getHiResIcon(options.iconUrl).then((url) => {
                    if (item.primitive && !item.primitive.isDestroyed?.()) {
                        item.primitive.image = url;
                        globalRequestRender();
                    }
                });
            }
        }
        const rot = options.rotation ? -CesiumMath.toRadians(options.rotation) : 0;
        if (item.primitive.rotation !== rot) item.primitive.rotation = rot;
        if (item.primitive.width !== getBaseSize()) item.primitive.width = getBaseSize();
        if (item.primitive.height !== getBaseSize()) item.primitive.height = getBaseSize();
        const targetScale = options.iconScale ?? DEFAULT_BILLBOARD_SCALE;
        if (item.primitive.scale !== targetScale) item.primitive.scale = targetScale;
    } else {
        const newSize = options.size || defaultPointSize();
        if (item.primitive.pixelSize !== newSize) item.primitive.pixelSize = newSize;
        if (!Color.equals(item.primitive.outlineColor, item.baseOutlineColor)) item.primitive.outlineColor = item.baseOutlineColor;
        const newOutlineWidth = options.outlineWidth || 1;
        if (item.primitive.outlineWidth !== newOutlineWidth) item.primitive.outlineWidth = newOutlineWidth;
    }
}

/** Create a new primitive + AnimatableItem and add it to the existingMap. */
export function createNewItem(
    entity: GeoEntity, options: CesiumEntityOptions, color: Color, clickId: any,
    existingMap: Map<string, AnimatableItem>,
    points: PointPrimitiveCollection, billboards: BillboardCollection,
) {
    const newPosition = Cartesian3.clone(scratchPosition);
    const outlineColor = getCachedColor(options.outlineColor) || Color.BLACK;
    const ddc = options.distanceDisplayCondition
        ? new DistanceDisplayCondition(options.distanceDisplayCondition.near, options.distanceDisplayCondition.far)
        : undefined;
    // Use the hi-res cached icon if available, otherwise use raw and trigger async upscale
    const resolvedIcon = options.iconUrl ? (getHiResIconSync(options.iconUrl) ?? options.iconUrl) : undefined;
    const baseSize = getBaseSize();
    const billboardColor = (options as any)._isAutoSVG ? Color.WHITE : color;

    const addedPrimitive = options.iconUrl
        ? billboards.add({
            position: newPosition, image: resolvedIcon,
            width: baseSize, height: baseSize,
            scale: options.iconScale ?? DEFAULT_BILLBOARD_SCALE,
            verticalOrigin: VerticalOrigin.CENTER, horizontalOrigin: HorizontalOrigin.CENTER,
            rotation: options.rotation ? -CesiumMath.toRadians(options.rotation) : 0,
            color: billboardColor, scaleByDistance: new NearFarScalar(1e6, 1.0, 2e7, 0.5), id: clickId,
            eyeOffset: new Cartesian3(0, 0, options.depthBias ?? -10000), // Small depth bias for far-range terrain
            // WARNING: Do NOT use heightReference: HeightReference.CLAMP_TO_GROUND here.
            // It causes severe lag/performance drops with thousands of dynamic entities.
            disableDepthTestDistance: options.disableDepthTestDistance ?? Number.POSITIVE_INFINITY, distanceDisplayCondition: ddc,
        })
        : points.add({
            position: newPosition, pixelSize: options.size || defaultPointSize(), color, outlineColor,
            outlineWidth: options.outlineWidth || 1,
            scaleByDistance: new NearFarScalar(1e6, 1.0, 2e7, 0.5), id: clickId,
            disableDepthTestDistance: options.disableDepthTestDistance ?? Number.POSITIVE_INFINITY, distanceDisplayCondition: ddc,
        });
    existingMap.set(entity.id, {
        primitive: addedPrimitive, labelPrimitive: undefined, entity, posRef: newPosition,
        options, baseColor: color, baseOutlineColor: outlineColor, lastHighlightState: 'normal'
    });

    // Trigger async upscale for newly spawned primitives that missed the cache
    if (options.iconUrl && resolvedIcon === options.iconUrl) {
        getHiResIcon(options.iconUrl).then((url) => {
            const bb = addedPrimitive as any;
            if (bb && !bb.isDestroyed?.()) {
                bb.image = url;
                globalRequestRender();
            }
        });
    }
}

/** Cleanup primitives for entities no longer in visibleEntities. */
export function cleanupRemovedEntities(
    existingMap: Map<string, AnimatableItem>, currentIds: Set<string>,
    points: PointPrimitiveCollection, billboards: BillboardCollection, labels: LabelCollection,
    polylines: any
) {
    for (const [id, item] of existingMap.entries()) {
        if (!currentIds.has(id)) {
            if (item.options.iconUrl) billboards.remove(item.primitive); else points.remove(item.primitive);
            item.primitive = null;
            if (item.labelPrimitive) { labels.remove(item.labelPrimitive); item.labelPrimitive = undefined; }
            if (item.polylinePrimitive) {
                polylines.remove(item.polylinePrimitive); 
            }
            item.polylinePrimitive = undefined;
            item.trailPositions = undefined;
            existingMap.delete(id);
        }
    }
}

/**
 * Manages 3D glTF model primitives on the Cesium viewer.
 * Models are loaded asynchronously and cached by URL to avoid re-downloading.
 */
import {
    Cartesian3,
    Color,
    HeadingPitchRoll,
    Math as CesiumMath,
    Model,
    Transforms,
    Matrix4,
} from "cesium";
import type { Scene } from "cesium";
import type { AnimatableItem } from "./EntityRenderer";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";

/** Track pending model loads to prevent duplicate async loads for the same entity */
const pendingLoads = new Set<string>();

/** Scratch objects reused every frame to avoid heap allocations */
const scratchHPR = new HeadingPitchRoll();
const scratchMatrix = new Matrix4();

/**
 * Create a 3D model primitive for an entity and attach it to the scene.
 * This is async because Model.fromGltfAsync needs to download/parse the glTF.
 */
export async function createModelPrimitive(
    scene: Scene,
    item: AnimatableItem
): Promise<void> {
    const { entity, options, posRef } = item;
    if (!options.modelUrl || pendingLoads.has(entity.id)) return;

    pendingLoads.add(entity.id);

    try {
        const offset = options.modelHeadingOffset || 0;
        const headingRad = CesiumMath.toRadians((entity.heading || 0) + offset);
        const hpr = new HeadingPitchRoll(headingRad, 0, 0);
        const modelMatrix = Transforms.headingPitchRollToFixedFrame(posRef, hpr);

        const scale = options.modelScale || 1.0;
        Matrix4.multiplyByUniformScale(modelMatrix, scale, modelMatrix);

        const model = await Model.fromGltfAsync({
            url: options.modelUrl,
            modelMatrix,
            scale: 1.0, // Scale is baked into the modelMatrix
            minimumPixelSize: options.modelMinPixelSize ?? 24,
            maximumScale: scale * 5,
            color: options.color ? Color.fromCssColorString(options.color) : undefined,
            silhouetteColor: Color.CYAN,
            silhouetteSize: 0,
            id: { _wwvEntity: entity },
        });

        if (scene.isDestroyed()) return;

        scene.primitives.add(model);
        item.primitive = model;
    } catch (err) {
        console.warn(`[ModelManager] Failed to load model for ${entity.id}:`, err);
    } finally {
        pendingLoads.delete(entity.id);
    }
}

/**
 * Update the position and heading of an existing model primitive.
 * Uses scratch allocations to avoid per-frame heap pressure.
 */
export function updateModelTransform(
    item: AnimatableItem,
    position: Cartesian3,
    heading?: number
): void {
    const model = item.primitive;
    if (!model || !model.modelMatrix) return;

    const offset = item.options.modelHeadingOffset || 0;
    scratchHPR.heading = CesiumMath.toRadians((heading || 0) + offset);
    scratchHPR.pitch = 0;
    scratchHPR.roll = 0;
    Transforms.headingPitchRollToFixedFrame(position, scratchHPR,
        undefined, undefined, scratchMatrix);

    const scale = item.options.modelScale || 1.0;
    Matrix4.multiplyByUniformScale(scratchMatrix, scale, scratchMatrix);

    Matrix4.clone(scratchMatrix, model.modelMatrix);
}

/**
 * Remove a model primitive from the scene.
 */
export function removeModelPrimitive(scene: Scene, item: AnimatableItem): void {
    if (!item.primitive) return;
    try {
        scene.primitives.remove(item.primitive);
    } catch { /* Already removed or destroyed */ }
}

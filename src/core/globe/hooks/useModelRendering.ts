/**
 * LOD hook: renders nearby model-type entities as 3D glTF models,
 * while distant ones fall back to the billboard/point pipeline.
 *
 * Strategy: All model-type entities ALSO go through useEntityRendering
 * as billboards (fallback). This hook promotes nearby ones to 3D models
 * and hides their billboard, capping GPU model count to ~MAX_MODELS.
 */
import { useEffect, useRef } from "react";
import {
    Cartesian3,
    Color,
    HeadingPitchRoll,
    Math as CesiumMath,
    Model,
    Transforms,
    Matrix4,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";
import type { AnimatableItem } from "../EntityRenderer";

/** Maximum concurrent 3D models to keep GPU happy */
const MAX_MODELS = 30;
/** Distance threshold in meters — closer than this gets a 3D model */
const MODEL_DISTANCE_M = 80_000; // 80km

interface ActiveModel {
    model: any;
    entityId: string;
    distance: number;
}

function buildModelMatrix(position: Cartesian3, heading: number, scale: number): Matrix4 {
    const hpr = new HeadingPitchRoll(CesiumMath.toRadians(heading), 0, 0);
    const matrix = Transforms.headingPitchRollToFixedFrame(position, hpr);
    Matrix4.multiplyByUniformScale(matrix, scale, matrix);
    return matrix;
}

export function useModelRendering(
    viewer: CesiumViewer | null,
    isReady: boolean,
    animatablesMapRef: React.MutableRefObject<Map<string, AnimatableItem>>
) {
    const activeModelsRef = useRef<Map<string, ActiveModel>>(new Map());
    const loadingRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!viewer || !isReady || viewer.isDestroyed()) return;

        const activeModels = activeModelsRef.current;
        const loading = loadingRef.current;

        const updateLOD = () => {
            if (viewer.isDestroyed()) return;
            const camPos = viewer.camera.positionWC;
            const animatables = animatablesMapRef.current;
            if (!animatables) return;

            // 1. Score all model-type entities by distance
            const candidates: Array<{ id: string; item: AnimatableItem; distance: number }> = [];

            for (const [id, item] of animatables.entries()) {
                if (item.options.type !== "model" || !item.options.modelUrl) continue;
                const dist = Cartesian3.distance(camPos, item.posRef);
                if (dist < MODEL_DISTANCE_M) {
                    candidates.push({ id, item, distance: dist });
                }
            }

            // Sort by distance (closest first) and cap at MAX_MODELS
            candidates.sort((a, b) => a.distance - b.distance);
            const promoted = candidates.slice(0, MAX_MODELS);
            const promotedIds = new Set(promoted.map(c => c.id));

            // 2. Remove models that are no longer promoted
            for (const [id, active] of activeModels.entries()) {
                if (!promotedIds.has(id)) {
                    try { viewer.scene.primitives.remove(active.model); } catch { /**/ }
                    activeModels.delete(id);
                    // Show billboard again and clear promoted flag
                    const item = animatables.get(id);
                    if (item) {
                        item._modelPromoted = false;
                        if (item.primitive) item.primitive.show = true;
                    }
                }
            }

            // 3. Create/update promoted models
            for (const { id, item, distance } of promoted) {
                const pos = item.posRef;
                const heading = item.entity.heading || 0;
                const scale = item.options.modelScale || 1.0;

                const existing = activeModels.get(id);
                if (existing) {
                    // Update transform
                    const newMatrix = buildModelMatrix(pos, heading, scale);
                    Matrix4.clone(newMatrix, existing.model.modelMatrix);
                    existing.distance = distance;
                    // Keep billboard hidden via flag
                    item._modelPromoted = true;
                    if (item.primitive) item.primitive.show = false;
                    continue;
                }

                // Skip if already loading
                if (loading.has(id)) {
                    item._modelPromoted = true;
                    if (item.primitive) item.primitive.show = false;
                    continue;
                }

                // Load new model
                loading.add(id);
                item._modelPromoted = true;
                if (item.primitive) item.primitive.show = false;

                Model.fromGltfAsync({
                    url: item.options.modelUrl!,
                    modelMatrix: buildModelMatrix(pos, heading, scale),
                    minimumPixelSize: item.options.modelMinPixelSize ?? 24,
                    maximumScale: scale * 5,
                    color: item.options.color ? Color.fromCssColorString(item.options.color) : undefined,
                    silhouetteColor: Color.CYAN,
                    silhouetteSize: 0,
                    id: { _wwvEntity: item.entity },
                }).then(model => {
                    loading.delete(id);
                    if (!viewer || viewer.isDestroyed()) return;
                    // Re-check still promoted
                    if (!animatables.has(id)) return;
                    viewer.scene.primitives.add(model);
                    activeModels.set(id, { model, entityId: id, distance });
                }).catch(() => {
                    loading.delete(id);
                    // Show billboard again on failure
                    item._modelPromoted = false;
                    if (item.primitive) item.primitive.show = true;
                });
            }
        };

        // Run LOD check at a lower frequency (every 10 frames)
        let frameCount = 0;
        const onPreUpdate = () => {
            if (frameCount++ % 10 === 0) updateLOD();
        };

        viewer.scene.preUpdate.addEventListener(onPreUpdate);

        return () => {
            if (!viewer.isDestroyed()) {
                viewer.scene.preUpdate.removeEventListener(onPreUpdate);
            }
            // Cleanup all active models
            for (const [, active] of activeModels.entries()) {
                try { viewer.scene.primitives.remove(active.model); } catch { /**/ }
            }
            activeModels.clear();
            loading.clear();
        };
    }, [viewer, isReady, animatablesMapRef]);
}

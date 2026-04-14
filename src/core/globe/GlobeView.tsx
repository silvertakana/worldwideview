"use client";
// @refresh reset

import React, { useEffect, useRef, useMemo } from "react";
import { Ion, Entity as CesiumEntity, Transforms, Matrix4, Cartesian3, HeadingPitchRoll, Math as CesiumMath } from "cesium";
import { Viewer } from "resium";
import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";
import { applyFilters } from "@/core/filters/filterEngine";
import { subscribeToCameraPresets } from "./CameraController";
import { setupInteractionHandlers } from "./InteractionHandler";
import { useBorders } from "./useBorders";
import { dataBus } from "@/core/data/DataBus";

import { handleEntitySelection, cleanupTrail } from "./SelectionHandler";
import { useImageryManager } from "./useImageryManager";
import { getCachedRenderOptions } from "./renderOptionsCache";
import type { AnimatableItem } from "./EntityRenderer";

/** Stable references */
const CONTEXT_OPTIONS = { requestWebgl2: true, webgl: { antialias: true } } as const;
const VIEWER_STYLE = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const;

// New Hooks
import { useCameraActions } from "./hooks/useCameraActions";
import { useSelectionAnchor } from "./hooks/useSelectionAnchor";
import { useCameraSync } from "./hooks/useCameraSync";
import { useEntityRendering } from "./hooks/useEntityRendering";
import { useModelRendering } from "./hooks/useModelRendering";
import { useFrustumRendering } from "./hooks/useFrustumRendering";
import { useSatelliteFrustum } from "./hooks/useSatelliteFrustum";
import { useTrailRendering } from "./hooks/useTrailRendering";
import { useViewerInitialization } from "./hooks/useViewerInitialization";
import { usePersistentDataSync } from "./hooks/usePersistentDataSync";

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN) {
    Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
}

export default function GlobeView() {
    const hoveredEntityIdRef = useRef<string | null>(null);
    const trailEntityRef = useRef<CesiumEntity | null>(null);
    const selectionEntityRef = useRef<CesiumEntity | null>(null);
    const animatablesMapRef = useRef(new Map<string, AnimatableItem>());

    const entitiesByPlugin = useStore((s) => s.entitiesByPlugin);
    const layers = useStore((s) => s.layers);
    const selectedEntity = useStore((s) => s.selectedEntity);
    const showLabels = layers["borders"]?.enabled ?? false;
    const showFps = useStore((s) => s.mapConfig.showFps);
    const resolutionScale = useStore((s) => s.mapConfig.resolutionScale);
    const antiAliasing = useStore((s) => s.mapConfig.antiAliasing);
    const maxScreenSpaceError = useStore((s) => s.mapConfig.maxScreenSpaceError);
    const shadowsEnabled = useStore((s) => s.mapConfig.shadowsEnabled);
    const enableLightingConfig = useStore((s) => s.mapConfig.enableLighting);
    const dayNightLayerEnabled = layers["daynight"]?.enabled ?? false;
    const enableLighting = enableLightingConfig || dayNightLayerEnabled;
    const sceneSettings = useMemo(() => ({
        showFps, resolutionScale, antiAliasing, maxScreenSpaceError,
        shadowsEnabled, enableLighting,
    }), [showFps, resolutionScale, antiAliasing, maxScreenSpaceError, shadowsEnabled, enableLighting]);
    const filters = useStore((s) => s.filters);
    const lockedEntityId = useStore((s) => s.lockedEntityId);
    const setCameraPosition = useStore((s) => s.setCameraPosition);
    const setFps = useStore((s) => s.setFps);

    usePersistentDataSync();
    const { viewerRef, viewerReady, handleViewerReady } = useViewerInitialization(sceneSettings);

    const visibleEntities = useMemo(() => {
        const result: Array<{ entity: GeoEntity; options: CesiumEntityOptions }> = [];
        pluginManager.getAllPlugins().forEach((managed) => {
            if (!layers[managed.plugin.id]?.enabled) return;
            if (managed.plugin.getLayerConfig().disableDefaultRendering) return;
            const entities = entitiesByPlugin[managed.plugin.id];
            if (!Array.isArray(entities)) return;
            const defs = managed.plugin.getFilterDefinitions?.() || [];
            const active = filters[managed.plugin.id] || {};
            applyFilters(entities, defs, active).forEach((entity) => {
                result.push({ entity, options: getCachedRenderOptions(managed.plugin, entity) });
            });
        });
        return result;
    }, [layers, entitiesByPlugin, filters]);

    const { isGoogle3D } = useImageryManager(viewerRef.current, viewerReady);
    useBorders(viewerRef.current, showLabels, isGoogle3D);

    useSelectionAnchor(viewerRef.current, viewerReady, selectedEntity, lockedEntityId, selectionEntityRef, animatablesMapRef);
    useCameraSync(viewerRef.current, viewerReady, setCameraPosition, setFps);
    useCameraActions(viewerRef.current, viewerReady);
    useEntityRendering(viewerRef.current, viewerReady, visibleEntities, animatablesMapRef, hoveredEntityIdRef, sceneSettings);
    useModelRendering(viewerRef.current, viewerReady, animatablesMapRef);
    useTrailRendering(viewerRef.current, viewerReady, animatablesMapRef);
    useSatelliteFrustum(viewerRef.current, viewerReady, selectedEntity, animatablesMapRef);

    const cameraLayerEnabled = layers["camera"]?.enabled ?? false;
    const cameraEntities = entitiesByPlugin["camera"] || [];
    useFrustumRendering(viewerRef.current, viewerReady, cameraEntities, cameraLayerEnabled);

    useEffect(() => {
        if (!viewerRef.current || viewerRef.current.isDestroyed()) return;
        return subscribeToCameraPresets(viewerRef.current);
    }, [viewerReady]);

    useEffect(() => {
        if (!viewerRef.current || viewerRef.current.isDestroyed()) return;
        return setupInteractionHandlers(viewerRef.current, hoveredEntityIdRef);
    }, [viewerReady]);

    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !viewerReady || viewer.isDestroyed()) return;
        cleanupTrail(viewer, trailEntityRef);
        if (selectedEntity) handleEntitySelection(viewer, selectedEntity, trailEntityRef, animatablesMapRef.current);
    }, [selectedEntity, viewerReady]);

    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !viewerReady || viewer.isDestroyed()) return;

        let trackingListener: (() => void) | undefined;
        let isFirstFrame = true;
        let targetZoomDistance: number | null = null;

        if (lockedEntityId && selectionEntityRef.current) {
            viewer.trackedEntity = undefined; // Force unbind native tracker entirely!
            
            // Re-sync local offset from World position on the very first frame to prevent deep space jumping.
            // Then continuously apply the difference on subsequent frames so the user can orbit manually.
            trackingListener = viewer.scene.preRender.addEventListener(() => {
                const item = animatablesMapRef.current?.get(lockedEntityId);
                if (!item || !item.posRef) return;

                const pos = item.posRef;
                const heading = item.entity.heading || 0;
                // Construct a reference frame that dynamically rotates with the model's Heading
                const hpr = new HeadingPitchRoll(CesiumMath.toRadians(heading), 0, 0);
                const transform = Transforms.headingPitchRollToFixedFrame(pos, hpr);

                if (isFirstFrame) {
                    const invTransform = Matrix4.inverseTransformation(transform, new Matrix4());
                    const localPos = Matrix4.multiplyByPoint(invTransform, viewer.camera.positionWC, new Cartesian3());
                    
                    // Force the camera direction to point perfectly at the origin (the plane)
                    const localDir = Cartesian3.normalize(Cartesian3.negate(localPos, new Cartesian3()), new Cartesian3());

                    // Compute an appropriate orthogonal UP vector
                    let right = Cartesian3.cross(localDir, Cartesian3.UNIT_Z, new Cartesian3());
                    if (Cartesian3.magnitudeSquared(right) < CesiumMath.EPSILON6) {
                        right = Cartesian3.UNIT_Y;
                    } else {
                        Cartesian3.normalize(right, right);
                    }
                    const localUp = Cartesian3.normalize(Cartesian3.cross(right, localDir, new Cartesian3()), new Cartesian3());

                    viewer.camera.lookAtTransform(transform);
                    Cartesian3.clone(localPos, viewer.camera.position);
                    Cartesian3.clone(localDir, viewer.camera.direction);
                    Cartesian3.clone(localUp, viewer.camera.up);
                    Cartesian3.cross(localDir, localUp, viewer.camera.right);
                    targetZoomDistance = 150;
                    isFirstFrame = false;
                } else {
                    const offset = Cartesian3.clone(viewer.camera.position);
                    const direction = Cartesian3.clone(viewer.camera.direction);
                    const up = Cartesian3.clone(viewer.camera.up);

                    if (targetZoomDistance !== null) {
                        const currentDist = Cartesian3.magnitude(offset);
                        if (Math.abs(currentDist - targetZoomDistance) > 1.0) {
                            // Fast initial approach, slow asymptotic ease-out at the end (20% resolution per frame)
                            const newDist = currentDist + (targetZoomDistance - currentDist) * 0.20;
                            Cartesian3.normalize(offset, offset);
                            Cartesian3.multiplyByScalar(offset, newDist, offset);
                        } else {
                            targetZoomDistance = null;
                        }
                    }

                    viewer.camera.lookAtTransform(transform);

                    Cartesian3.clone(offset, viewer.camera.position);
                    Cartesian3.clone(direction, viewer.camera.direction);
                    Cartesian3.clone(up, viewer.camera.up);
                    Cartesian3.cross(direction, up, viewer.camera.right);
                }
            });
        } else {
            viewer.trackedEntity = undefined;
            viewer.camera.lookAtTransform(Matrix4.IDENTITY);
        }

        return () => {
            if (trackingListener) trackingListener();
            if (viewer && !viewer.isDestroyed()) {
                viewer.camera.lookAtTransform(Matrix4.IDENTITY);
            }
        };
    }, [lockedEntityId, viewerReady]);

    const PluginGlobeComponents = useMemo(() => {
        return pluginManager.getAllPlugins()
            .filter(managed => managed.plugin.getGlobeComponent)
            .map(managed => {
                const Comp = managed.plugin.getGlobeComponent!();
                const enabled = layers[managed.plugin.id]?.enabled ?? false;
                return <Comp key={managed.plugin.id} viewer={viewerRef.current} enabled={enabled} />;
            });
    }, [layers]);

    return (
        <Viewer
            full
            ref={(e) => {
                const el = e?.cesiumElement;
                if (el && el !== viewerRef.current && !el.isDestroyed()) handleViewerReady(el);
            }}
            animation={false} baseLayerPicker={false} fullscreenButton={false}
            geocoder={false} homeButton={false} infoBox={false}
            navigationHelpButton={false} sceneModePicker={false}
            selectionIndicator={false} timeline={false} vrButton={false}
            baseLayer={false}
            contextOptions={CONTEXT_OPTIONS}
            style={VIEWER_STYLE}
        >
            {viewerReady && PluginGlobeComponents}
        </Viewer>
    );
}

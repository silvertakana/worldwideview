"use client";

import React, { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { Viewer } from "resium";
import {
    Ion,
    createGooglePhotorealistic3DTileset,
    Cartesian3,
    Entity as CesiumEntity,
    Matrix4,
    Ellipsoid,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";
import { applyFilters } from "@/core/filters/filterEngine";
import { flyToPreset, flyToPosition, subscribeToCameraPresets } from "./CameraController";
import { setupInteractionHandlers } from "./InteractionHandler";
import { BordersManager } from "./BordersManager";
import { initPrimitiveCollections, renderEntities } from "./EntityRenderer";
import { createUpdateLoop } from "./AnimationLoop";
import { handleEntitySelection, cleanupTrail } from "./SelectionHandler";
import { useImageryManager } from "./useImageryManager";
import { dataBus } from "@/core/data/DataBus";

// Set Cesium Ion token
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_CESIUM_TOKEN) {
    Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_TOKEN;
}

export default function GlobeView() {
    const viewerRef = useRef<CesiumViewer | null>(null);
    const hoveredEntityIdRef = useRef<string | null>(null);
    const trailEntityRef = useRef<CesiumEntity | null>(null);
    const selectionEntityRef = useRef<CesiumEntity | null>(null);
    const bordersManagerRef = useRef(new BordersManager());
    const [viewerReady, setViewerReady] = useState(false);

    const entitiesByPlugin = useStore((s) => s.entitiesByPlugin);
    const layers = useStore((s) => s.layers);
    const selectedEntity = useStore((s) => s.selectedEntity);
    const showLabels = useStore((s) => s.mapConfig.showLabels);
    const showFps = useStore((s) => s.mapConfig.showFps);
    const resolutionScale = useStore((s) => s.mapConfig.resolutionScale);
    const msaaSamples = useStore((s) => s.mapConfig.msaaSamples);
    const enableFxaa = useStore((s) => s.mapConfig.enableFxaa);
    const maxScreenSpaceError = useStore((s) => s.mapConfig.maxScreenSpaceError);
    const filters = useStore((s) => s.filters);
    const lockedEntityId = useStore((s) => s.lockedEntityId);

    // Camera position from store
    const cameraLat = useStore((s) => s.cameraLat);
    const cameraLon = useStore((s) => s.cameraLon);
    const cameraAlt = useStore((s) => s.cameraAlt);
    const cameraHeading = useStore((s) => s.cameraHeading);
    const cameraPitch = useStore((s) => s.cameraPitch);

    // Compute visible & filtered entities
    const visibleEntities = useMemo(() => {
        const result: Array<{ entity: GeoEntity; options: CesiumEntityOptions }> = [];
        pluginManager.getAllPlugins().forEach((managed) => {
            if (!layers[managed.plugin.id]?.enabled) return;
            const entities = entitiesByPlugin[managed.plugin.id] || [];
            const defs = managed.plugin.getFilterDefinitions?.() || [];
            const active = filters[managed.plugin.id] || {};
            applyFilters(entities, defs, active).forEach((entity) => {
                result.push({ entity, options: managed.plugin.renderEntity(entity) });
            });
        });
        return result;
    }, [layers, entitiesByPlugin, filters]);

    // Unified Imagery & Scene Mode Management
    useImageryManager(viewerRef.current);

    // Initialization of Selection Entity
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !viewerReady) return;

        // Create a hidden entity for camera tracking/flying
        const entity = viewer.entities.add({
            id: "__wwv_selection_anchor",
            show: false,
        });
        selectionEntityRef.current = entity;

        return () => {
            if (!viewer.isDestroyed()) {
                viewer.entities.remove(entity);
            }
        };
    }, [viewerReady]);

    // Update Selection Entity Position
    useEffect(() => {
        const selectionEntity = selectionEntityRef.current;
        if (!selectionEntity || !selectedEntity) return;

        selectionEntity.position = Cartesian3.fromDegrees(
            selectedEntity.longitude,
            selectedEntity.latitude,
            selectedEntity.altitude || 0
        ) as any;
    }, [selectedEntity, entitiesByPlugin]);

    // Camera preset events
    useEffect(() => {
        if (!viewerRef.current) return;
        return subscribeToCameraPresets(viewerRef.current);
    }, [viewerReady]);

    // Camera position sync from store
    useEffect(() => {
        if (!viewerRef.current) return;
        flyToPosition(viewerRef.current, cameraLat, cameraLon, cameraAlt, cameraHeading, cameraPitch);
    }, [cameraLat, cameraLon, cameraAlt, cameraHeading, cameraPitch]);

    // Click/hover handlers
    useEffect(() => {
        if (!viewerRef.current) return;
        return setupInteractionHandlers(viewerRef.current, hoveredEntityIdRef);
    }, [viewerReady]);

    // Borders/labels
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;
        // Globe visibility is now managed by useImageryManager
        if (showLabels) {
            bordersManagerRef.current.show(viewer);
        } else {
            bordersManagerRef.current.hide(viewer);
        }
    }, [showLabels, viewerReady]);

    // Viewer initialization
    const handleViewerReady = useCallback(async (viewer: CesiumViewer) => {
        viewerRef.current = viewer;
        viewer.scene.requestRenderMode = false;
        viewer.scene.maximumRenderTimeChange = Infinity;
        viewer.scene.debugShowFramesPerSecond = showFps;
        viewer.resolutionScale = resolutionScale;
        viewer.scene.msaaSamples = msaaSamples;
        viewer.scene.postProcessStages.fxaa.enabled = enableFxaa;

        // Initialize Google Photorealistic 3D Tiles once
        try {
            const tileset = await createGooglePhotorealistic3DTileset({
                key: process.env.GOOGLE_MAPS_API_KEY || undefined,
            });
            tileset.maximumScreenSpaceError = maxScreenSpaceError;
            viewer.scene.primitives.add(tileset);
            // useImageryManager will handle its visibility based on state
        } catch (err) {
            console.warn("[GlobeView] Failed to initialize Google 3D Tiles:", err);
        }

        initPrimitiveCollections(viewer);
        viewer.camera.setView({ destination: Cartesian3.fromDegrees(0, 20, 20000000) });
        setViewerReady(true);
    }, [showFps, resolutionScale, msaaSamples, enableFxaa, maxScreenSpaceError]);

    // Entity rendering + animation loop
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !viewerReady) return;

        const animatables = renderEntities(viewer, visibleEntities);
        const updatePositions = createUpdateLoop(viewer, animatables, hoveredEntityIdRef);

        // Sync scene settings
        viewer.scene.debugShowFramesPerSecond = showFps;
        viewer.resolutionScale = resolutionScale;
        viewer.scene.msaaSamples = msaaSamples;
        viewer.scene.postProcessStages.fxaa.enabled = enableFxaa;
        const primitives = viewer.scene.primitives as any;
        for (let i = 0; i < primitives.length; i++) {
            const p = primitives.get(i);
            if (p?.maximumScreenSpaceError !== undefined) p.maximumScreenSpaceError = maxScreenSpaceError;
        }

        viewer.scene.preUpdate.addEventListener(updatePositions);
        return () => {
            if (!viewer.isDestroyed()) viewer.scene.preUpdate.removeEventListener(updatePositions);
        };
    }, [visibleEntities, viewerReady, showFps, resolutionScale, msaaSamples, enableFxaa, maxScreenSpaceError]);

    // Entity selection → fly-to + trail
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !viewerReady) return;
        cleanupTrail(viewer, trailEntityRef);
        if (selectedEntity) handleEntitySelection(viewer, selectedEntity, trailEntityRef);
    }, [selectedEntity, viewerReady]);

    // Camera action events (Face Towards, Go To, Lock)
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !viewerReady) return;

        const unsubFace = dataBus.on("cameraFaceTowards", ({ lat, lon, alt }) => {
            console.log("[GlobeView] Native faceTowards", lat, lon, alt);
            const target = Cartesian3.fromDegrees(lon, lat, alt);
            const offset = Cartesian3.subtract(
                viewer.camera.positionWC,
                target,
                new Cartesian3()
            );
            // lookAt sets the view relative to the target's ENU frame
            viewer.camera.lookAt(target, offset);
            // Immediately release the transform to allow free camera movement again
            // while preserving the orientation
            viewer.camera.lookAtTransform(Matrix4.IDENTITY);
        });

        const unsubGoTo = dataBus.on("cameraGoTo", () => {
            console.log("[GlobeView] Native flyTo selectionEntity");
            if (selectionEntityRef.current) {
                viewer.flyTo(selectionEntityRef.current, {
                    duration: 1.5,
                });
            }
        });

        return () => {
            unsubFace();
            unsubGoTo();
        };
    }, [viewerReady]);

    // Camera lock: Use native viewer.trackedEntity
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !viewerReady) return;

        if (lockedEntityId && selectionEntityRef.current) {
            console.log("[GlobeView] Locking camera to", lockedEntityId);
            viewer.trackedEntity = selectionEntityRef.current;
        } else {
            console.log("[GlobeView] Unlocking camera");
            viewer.trackedEntity = undefined;
        }
    }, [lockedEntityId, viewerReady]);

    return (
        <Viewer
            full
            ref={(e) => {
                if (e?.cesiumElement && !viewerRef.current) handleViewerReady(e.cesiumElement);
            }}
            animation={false} baseLayerPicker={false} fullscreenButton={false}
            geocoder={false} homeButton={false} infoBox={false}
            navigationHelpButton={false} sceneModePicker={false}
            selectionIndicator={false} timeline={false} vrButton={false}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
    );
}

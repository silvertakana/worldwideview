"use client";
// @refresh reset

import React, { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { Viewer } from "resium";
import {
    Ion,
    createGooglePhotorealistic3DTileset,
    Cartesian3,
    Math as CesiumMath,
    Entity as CesiumEntity,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";
import { applyFilters } from "@/core/filters/filterEngine";
import { subscribeToCameraPresets } from "./CameraController";
import { setupInteractionHandlers } from "./InteractionHandler";
import { useBorders } from "./useBorders";
import { initPrimitiveCollections, AnimatableItem } from "./EntityRenderer";
import { handleEntitySelection, cleanupTrail } from "./SelectionHandler";
import { useImageryManager } from "./useImageryManager";
import { dataBus } from "@/core/data/DataBus";

// New Hooks
import { useCameraActions } from "./hooks/useCameraActions";
import { useSelectionAnchor } from "./hooks/useSelectionAnchor";
import { useCameraSync } from "./hooks/useCameraSync";
import { useEntityRendering } from "./hooks/useEntityRendering";
import { useModelRendering } from "./hooks/useModelRendering";
import { useFrustumRendering } from "./hooks/useFrustumRendering";

// Set Cesium Ion token
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_CESIUM_TOKEN) {
    Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_TOKEN;
}

export default function GlobeView() {
    const viewerRef = useRef<CesiumViewer | null>(null);
    const hoveredEntityIdRef = useRef<string | null>(null);
    const trailEntityRef = useRef<CesiumEntity | null>(null);
    const selectionEntityRef = useRef<CesiumEntity | null>(null);
    const animatablesMapRef = useRef(new Map<string, AnimatableItem>());
    const [viewerReady, setViewerReady] = useState(false);

    const entitiesByPlugin = useStore((s) => s.entitiesByPlugin);
    const layers = useStore((s) => s.layers);
    const selectedEntity = useStore((s) => s.selectedEntity);
    const showLabels = layers["borders"]?.enabled ?? false;
    const sceneSettings = {
        showFps: useStore((s) => s.mapConfig.showFps),
        resolutionScale: useStore((s) => s.mapConfig.resolutionScale),
        msaaSamples: useStore((s) => s.mapConfig.msaaSamples),
        enableFxaa: useStore((s) => s.mapConfig.enableFxaa),
        maxScreenSpaceError: useStore((s) => s.mapConfig.maxScreenSpaceError),
    };
    const filters = useStore((s) => s.filters);
    const lockedEntityId = useStore((s) => s.lockedEntityId);
    const setCameraPosition = useStore((s) => s.setCameraPosition);
    const setFps = useStore((s) => s.setFps);

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

    // Imagery & Scene Management Hooks
    const { isGoogle3D } = useImageryManager(viewerRef.current);
    useBorders(viewerRef.current, showLabels, isGoogle3D);

    // UI/Interaction Hooks
    useSelectionAnchor(viewerRef.current, viewerReady, selectedEntity, selectionEntityRef, animatablesMapRef);
    useCameraSync(viewerRef.current, viewerReady, setCameraPosition, setFps);
    useCameraActions(viewerRef.current, viewerReady);
    // All entities go through billboard/point pipeline (including model-type as fallback)
    useEntityRendering(viewerRef.current, viewerReady, visibleEntities, animatablesMapRef, hoveredEntityIdRef, sceneSettings);
    // LOD: promote nearby model-type entities to 3D models, hiding their billboard
    useModelRendering(viewerRef.current, viewerReady, animatablesMapRef);

    // Frustum outlines for camera entities
    const cameraLayerEnabled = layers["camera"]?.enabled ?? false;
    const cameraEntities = entitiesByPlugin["camera"] || [];
    useFrustumRendering(viewerRef.current, viewerReady, cameraEntities, cameraLayerEnabled);

    // Camera preset events
    useEffect(() => {
        if (!viewerRef.current || viewerRef.current.isDestroyed()) return;
        return subscribeToCameraPresets(viewerRef.current);
    }, [viewerReady]);

    // Click/hover handlers
    useEffect(() => {
        if (!viewerRef.current || viewerRef.current.isDestroyed()) return;
        return setupInteractionHandlers(viewerRef.current, hoveredEntityIdRef);
    }, [viewerReady]);

    // Viewer initialization
    const handleViewerReady = useCallback(async (viewer: CesiumViewer) => {
        viewerRef.current = viewer;
        viewer.scene.requestRenderMode = false;
        viewer.scene.maximumRenderTimeChange = Infinity;
        viewer.scene.debugShowFramesPerSecond = sceneSettings.showFps;
        viewer.resolutionScale = sceneSettings.resolutionScale;
        viewer.scene.msaaSamples = sceneSettings.msaaSamples;
        viewer.scene.postProcessStages.fxaa.enabled = sceneSettings.enableFxaa;

        // Pre-load LOD trick: Start camera close to Earth to force downloading high-detail tiles.
        // We will teleport to deep space right before the overlay fades.
        viewer.camera.setView({ destination: Cartesian3.fromDegrees(0, 20, 10000000) });

        // Initialize Google Photorealistic 3D Tiles once
        try {
            const tileset = await createGooglePhotorealistic3DTileset({
                key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || undefined,
                onlyUsingWithGoogleGeocoder: true,
            });
            tileset.maximumScreenSpaceError = sceneSettings.maxScreenSpaceError;
            viewer.scene.primitives.add(tileset);

            // Signal when initial tiles are loaded (globe looks solid)
            const removeListener = tileset.initialTilesLoaded.addEventListener(() => {
                console.log("[GlobeView] Initial tiles loaded — globe ready.");

                // Teleport to deep space behind the still-visible overlay
                // so the fly-in animation comes from afar smoothly.
                viewer.camera.setView({ destination: Cartesian3.fromDegrees(0, 20, 60000000) });

                dataBus.emit("globeReady", {} as Record<string, never>);
                removeListener();
            });
        } catch (err) {
            console.warn("[GlobeView] Failed to initialize Google 3D Tiles:", err);
            // Still emit globeReady so UI doesn't stay locked
            dataBus.emit("globeReady", {} as Record<string, never>);
        }

        initPrimitiveCollections(viewer);
        setViewerReady(true);
    }, [sceneSettings]);

    // Entity selection → fly-to + trail
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !viewerReady || viewer.isDestroyed()) return;
        cleanupTrail(viewer, trailEntityRef);
        if (selectedEntity) handleEntitySelection(viewer, selectedEntity, trailEntityRef, animatablesMapRef.current);
    }, [selectedEntity, viewerReady]);

    // Camera lock
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !viewerReady || viewer.isDestroyed()) return;

        if (lockedEntityId && selectionEntityRef.current) {
            viewer.trackedEntity = selectionEntityRef.current;
        } else {
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

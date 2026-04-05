"use client";
// @refresh reset

import React, { useEffect, useRef, useMemo } from "react";
import { Ion, Entity as CesiumEntity } from "cesium";
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

    const { isGoogle3D } = useImageryManager(viewerRef.current);
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

        if (lockedEntityId && selectionEntityRef.current) {
            viewer.trackedEntity = selectionEntityRef.current;
        } else {
            viewer.trackedEntity = undefined;
        }
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

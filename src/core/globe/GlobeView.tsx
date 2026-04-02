"use client";
// @refresh reset

import React, { useEffect, useRef, useCallback, useMemo, useState } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import { Viewer } from "resium";
import {
    Ion,
    createGooglePhotorealistic3DTileset,
    Cartesian3,
    Math as CesiumMath,
    Entity as CesiumEntity,
    CameraEventType,
    KeyboardEventModifier,
} from "cesium";
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
import { getCachedRenderOptions } from "./renderOptionsCache";
import { isDemo } from "@/core/edition";

/** Stable references — must live outside the component to avoid Resium re-creating the Viewer. */
const CONTEXT_OPTIONS = { requestWebgl2: true, webgl: { antialias: true } } as const;
const VIEWER_STYLE = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const;

// New Hooks
import { useCameraActions } from "./hooks/useCameraActions";
import { useSelectionAnchor } from "./hooks/useSelectionAnchor";
import { useCameraSync } from "./hooks/useCameraSync";
import { useEntityRendering } from "./hooks/useEntityRendering";
import { useModelRendering } from "./hooks/useModelRendering";
import { useFrustumRendering } from "./hooks/useFrustumRendering";
import { useTrailRendering } from "./hooks/useTrailRendering";

// Set Cesium Ion token
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN) {
    Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
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
    const showFps = useStore((s) => s.mapConfig.showFps);
    const resolutionScale = useStore((s) => s.mapConfig.resolutionScale);
    const antiAliasing = useStore((s) => s.mapConfig.antiAliasing);
    const maxScreenSpaceError = useStore((s) => s.mapConfig.maxScreenSpaceError);
    const shadowsEnabled = useStore((s) => s.mapConfig.shadowsEnabled);
    const enableLighting = useStore((s) => s.mapConfig.enableLighting);
    const sceneSettings = useMemo(() => ({
        showFps, resolutionScale, antiAliasing, maxScreenSpaceError,
        shadowsEnabled, enableLighting,
    }), [showFps, resolutionScale, antiAliasing, maxScreenSpaceError,
        shadowsEnabled, enableLighting]);
    const filters = useStore((s) => s.filters);
    const lockedEntityId = useStore((s) => s.lockedEntityId);
    const setCameraPosition = useStore((s) => s.setCameraPosition);
    const setFps = useStore((s) => s.setFps);
    const updateMapConfig = useStore((s) => s.updateMapConfig);
    const initFavorites = useStore((s) => s.initFavorites);

    // Load graphics settings from cookie on mount
    useEffect(() => {
        try {
            const match = document.cookie.match(/(^| )wwv_graphics=([^;]+)/);
            if (match) {
                const saved = JSON.parse(decodeURIComponent(match[2]));
                updateMapConfig(saved);
            }
        } catch (e) {
            console.warn("[GlobeView] Failed to load graphics settings from cookie", e);
        }
    }, [updateMapConfig]);

    // Initialize favorites from cookie or API
    useEffect(() => {
        if (isDemo) {
            try {
                const match = document.cookie.match(/(^| )wwv_favorites=([^;]+)/);
                if (match) {
                    const saved = JSON.parse(decodeURIComponent(match[2]));
                    initFavorites(saved);
                }
            } catch (e) {
                console.warn("[GlobeView] Failed to load favorites from cookie", e);
            }
        } else {
            fetch("/api/user/favorites")
                .then(res => {
                    if (res.status === 401) return []; // Unauthenticated, safe to ignore
                    if (res.ok) return res.json();
                    throw new Error("Failed to load favorites");
                })
                .then(data => {
                    if (Array.isArray(data)) {
                        const mappedFavorites = data.map((item: any) => ({
                            id: item.entityId, // Restore entity property matching
                            pluginId: item.pluginId,
                            label: item.label,
                            pluginName: item.pluginName,
                            lastSeen: new Date(item.lastSeen).getTime()
                        }));
                        initFavorites(mappedFavorites);
                    }
                })
                .catch(err => console.error("[GlobeView] Favorites fetch error:", err));
        }
    }, [initFavorites]);

    // Compute visible & filtered entities (DOD: renderEntity results are memoized)
    const visibleEntities = useMemo(() => {
        const result: Array<{ entity: GeoEntity; options: CesiumEntityOptions }> = [];
        pluginManager.getAllPlugins().forEach((managed) => {
            if (!layers[managed.plugin.id]?.enabled) return;
            const entities = entitiesByPlugin[managed.plugin.id] || [];
            const defs = managed.plugin.getFilterDefinitions?.() || [];
            const active = filters[managed.plugin.id] || {};
            applyFilters(entities, defs, active).forEach((entity) => {
                result.push({ entity, options: getCachedRenderOptions(managed.plugin, entity) });
            });
        });
        return result;
    }, [layers, entitiesByPlugin, filters]);

    // Imagery & Scene Management Hooks
    const { isGoogle3D } = useImageryManager(viewerRef.current);
    useBorders(viewerRef.current, showLabels, isGoogle3D);

    // UI/Interaction Hooks
    useSelectionAnchor(viewerRef.current, viewerReady, selectedEntity, lockedEntityId, selectionEntityRef, animatablesMapRef);
    useCameraSync(viewerRef.current, viewerReady, setCameraPosition, setFps);
    useCameraActions(viewerRef.current, viewerReady);
    // All entities go through billboard/point pipeline (including model-type as fallback)
    useEntityRendering(viewerRef.current, viewerReady, visibleEntities, animatablesMapRef, hoveredEntityIdRef, sceneSettings);
    // LOD: promote nearby model-type entities to 3D models, hiding their billboard
    useModelRendering(viewerRef.current, viewerReady, animatablesMapRef);
    // Render historical trails for moving entities
    useTrailRendering(viewerRef.current, viewerReady, animatablesMapRef);

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
        viewer.scene.requestRenderMode = true;
        viewer.scene.maximumRenderTimeChange = 0.5;
        viewer.scene.debugShowFramesPerSecond = sceneSettings.showFps;
        viewer.resolutionScale = sceneSettings.resolutionScale;
        viewer.scene.postProcessStages.fxaa.enabled = sceneSettings.antiAliasing === "fxaa";
        viewer.scene.msaaSamples = sceneSettings.antiAliasing === "none" || sceneSettings.antiAliasing === "fxaa" ? 1 : parseInt(sceneSettings.antiAliasing.replace("msaa", "").replace("x", ""), 10) || 1;
        viewer.scene.globe.depthTestAgainstTerrain = true;

        // Pre-load LOD trick: Start camera close to Earth to force downloading high-detail tiles.
        // We will teleport to deep space right before the overlay fades.
        viewer.camera.setView({ destination: Cartesian3.fromDegrees(0, 20, 10000000) });

        // Safety net: if the entire tileset pipeline stalls (await hangs,
        // initialTilesLoaded never fires, etc.), unblock the UI after 15s.
        let globeFired = false;
        const fireGlobeReady = () => {
            if (globeFired) return;
            globeFired = true;
            if (!viewer.isDestroyed()) {
                viewer.camera.setView({ destination: Cartesian3.fromDegrees(0, 20, 60000000) });
            }
            dataBus.emit("globeReady", {} as Record<string, never>);
        };
        const globalTimeout = setTimeout(() => {
            console.warn("[GlobeView] Global tile-init timeout (15s) — forcing globe ready.");
            fireGlobeReady();
        }, 15_000);

        // Initialize Google Photorealistic 3D Tiles once
        try {
            // enableCollision allows CLAMP_TO_GROUND to detect the 3D tile surface
            const tileset = await createGooglePhotorealistic3DTileset({
                key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || undefined,
                onlyUsingWithGoogleGeocoder: true,
                ...({ enableCollision: true } as Record<string, unknown>),
            });

            // Viewer may have been destroyed during the await (HMR, re-render, etc.)
            if (viewer.isDestroyed()) {
                console.warn("[GlobeView] Viewer destroyed during tileset init — aborting.");
                clearTimeout(globalTimeout);
                return;
            }

            tileset.maximumScreenSpaceError = sceneSettings.maxScreenSpaceError;
            viewer.scene.primitives.add(tileset);

            // Signal when initial tiles are loaded (globe looks solid)
            const removeListener = tileset.initialTilesLoaded.addEventListener(() => {
                console.log("[GlobeView] Initial tiles loaded — globe ready.");
                clearTimeout(globalTimeout);
                fireGlobeReady();
                removeListener();
            });
        } catch (err) {
            console.warn("[GlobeView] Failed to initialize Google 3D Tiles:", err);
            clearTimeout(globalTimeout);
            fireGlobeReady();
        }

        if (viewer.isDestroyed()) return;
        initPrimitiveCollections(viewer);

        // Reconfigure mouse bindings so right-click tilts/turns instead of zooming
        const sscc = viewer.scene.screenSpaceCameraController;
        sscc.tiltEventTypes = [
            CameraEventType.MIDDLE_DRAG,
            CameraEventType.RIGHT_DRAG,
            CameraEventType.PINCH,
            { eventType: CameraEventType.LEFT_DRAG, modifier: KeyboardEventModifier.CTRL },
            { eventType: CameraEventType.RIGHT_DRAG, modifier: KeyboardEventModifier.CTRL }
        ];
        sscc.zoomEventTypes = [
            CameraEventType.WHEEL,
            CameraEventType.PINCH
        ];

        // Increase touch sensitivity on mobile for pinch-zoom and pan
        if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
            (sscc as any)._zoomFactor = 15;        // default 5  → 3× more sensitive pinch-zoom
            (sscc as any)._translateFactor = 2;     // default 1  → 2× more sensitive pan
            (sscc as any)._tiltFactor = 50;         // default ~25 → 2× more sensitive tilt (two-finger drag up/down)
        }

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
        />
    );
}

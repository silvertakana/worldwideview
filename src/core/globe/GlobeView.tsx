"use client";

import React, { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { Viewer } from "resium";
import {
    Ion,
    createGooglePhotorealistic3DTileset,
    Cartesian3,
    Cartographic,
    Entity as CesiumEntity,
    Matrix4,
    Ellipsoid,
    Math as CesiumMath,
    HeadingPitchRange,
    Transforms,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";
import { applyFilters } from "@/core/filters/filterEngine";
import { flyToPreset, flyToPosition, subscribeToCameraPresets } from "./CameraController";
import { setupInteractionHandlers } from "./InteractionHandler";
import { BordersManager } from "./BordersManager";
import { initPrimitiveCollections, renderEntities, AnimatableItem } from "./EntityRenderer";
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
    const animatablesMapRef = useRef(new Map<string, AnimatableItem>());
    const [viewerReady, setViewerReady] = useState(false);

    const entitiesByPlugin = useStore((s) => s.entitiesByPlugin);
    const layers = useStore((s) => s.layers);
    const selectedEntity = useStore((s) => s.selectedEntity);
    const showLabels = layers["borders"]?.enabled ?? false;
    const showFps = useStore((s) => s.mapConfig.showFps);
    const resolutionScale = useStore((s) => s.mapConfig.resolutionScale);
    const msaaSamples = useStore((s) => s.mapConfig.msaaSamples);
    const enableFxaa = useStore((s) => s.mapConfig.enableFxaa);
    const maxScreenSpaceError = useStore((s) => s.mapConfig.maxScreenSpaceError);
    const filters = useStore((s) => s.filters);
    const lockedEntityId = useStore((s) => s.lockedEntityId);
    const setCameraPosition = useStore((s) => s.setCameraPosition);
    const setFps = useStore((s) => s.setFps);

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
            point: {
                pixelSize: 0,
            }
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

    // Camera Sync: Camera -> Store (updates stats panel)
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !viewerReady) return;

        const updateStore = () => {
            const camera = viewer.camera;
            if (!camera || !camera.position) return;

            const cartographic = Cartographic.fromCartesian(camera.position);
            if (!cartographic) return;

            const lat = CesiumMath.toDegrees(cartographic.latitude ?? 0);
            const lon = CesiumMath.toDegrees(cartographic.longitude ?? 0);
            const alt = cartographic.height ?? 0;
            const heading = CesiumMath.toDegrees(camera.heading ?? 0);
            const pitch = CesiumMath.toDegrees(camera.pitch ?? 0);
            const roll = CesiumMath.toDegrees(camera.roll ?? 0);

            // Use functional update to avoid unnecessary re-renders if values are close enough
            // But for HUD we want real-time, so we just call it.
            setCameraPosition(lat, lon, alt, heading, pitch, roll);
        };

        let frameCount = 0;
        let lastTime = performance.now();

        const updateFps = () => {
            frameCount++;
            const currentTime = performance.now();
            if (currentTime - lastTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                setFps(fps);
                frameCount = 0;
                lastTime = currentTime;
            }
        };

        viewer.scene.postRender.addEventListener(updateStore);
        viewer.scene.postRender.addEventListener(updateFps);

        return () => {
            if (!viewer.isDestroyed()) {
                viewer.scene.postRender.removeEventListener(updateStore);
                viewer.scene.postRender.removeEventListener(updateFps);
            }
        };
    }, [viewerReady, setCameraPosition, setFps]);

    // Camera Sync: Store -> Camera (one-way flyTo for external store changes)
    // We only trigger this if it's NOT a typical user movement (e.g. from preset)
    // To keep it simple, we'll leave it out for now as the buttons now use direct dataBus events
    // that don't go through the store's lat/lon properties for movement.


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

        const animatables = renderEntities(viewer, visibleEntities, animatablesMapRef.current);
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

        const unsubGoTo = dataBus.on("cameraGoTo", ({ lat, lon, alt, distance, maxPitch, heading }) => {
            // Add a slight delay to avoid any immediate state-change cancellations from React
            setTimeout(() => {
                const targetPosition = Cartesian3.fromDegrees(lon, lat, alt || 0);
                const cameraPosition = viewer.camera.positionWC;

                // Calculate direction from camera to the target object
                const direction = Cartesian3.subtract(targetPosition, cameraPosition, new Cartesian3());
                Cartesian3.normalize(direction, direction);

                // Enforce maximum pitch (default -30 degrees)
                const targetLocalUp = Ellipsoid.WGS84.geodeticSurfaceNormal(targetPosition, new Cartesian3());
                const pitchDot = Cartesian3.dot(direction, targetLocalUp);
                let pitch = Math.asin(pitchDot);
                const maxPitchRad = CesiumMath.toRadians(maxPitch !== undefined ? maxPitch : -30);

                if (pitch > maxPitchRad) {
                    pitch = maxPitchRad;
                    // Extract the horizontal component of the direction to reconstruct it
                    const vertComponent = Cartesian3.multiplyByScalar(targetLocalUp, pitchDot, new Cartesian3());
                    const horiz = Cartesian3.subtract(direction, vertComponent, new Cartesian3());

                    if (Cartesian3.magnitude(horiz) > 0.0001) {
                        Cartesian3.normalize(horiz, horiz);
                        const cosP = Math.cos(pitch);
                        const sinP = Math.sin(pitch);
                        const newHoriz = Cartesian3.multiplyByScalar(horiz, cosP, new Cartesian3());
                        const newVert = Cartesian3.multiplyByScalar(targetLocalUp, sinP, new Cartesian3());
                        Cartesian3.add(newHoriz, newVert, direction);
                        Cartesian3.normalize(direction, direction);
                    }
                }

                const viewDistance = distance !== undefined ? distance : Math.max(10000, (alt || 0) * 2 + 20000);

                let destination: Cartesian3;
                let orientation: any;

                if (heading !== undefined) {
                    const headingRad = CesiumMath.toRadians(heading);

                    // Offset in ENU frame at the target
                    const x_dir = Math.cos(pitch) * Math.sin(headingRad);
                    const y_dir = Math.cos(pitch) * Math.cos(headingRad);
                    const z_dir = Math.sin(pitch);

                    const offsetENU = new Cartesian3(
                        -x_dir * viewDistance,
                        -y_dir * viewDistance,
                        -z_dir * viewDistance
                    );

                    const enuTransform = Transforms.eastNorthUpToFixedFrame(targetPosition);
                    const offsetWC = Matrix4.multiplyByPointAsVector(enuTransform, offsetENU, new Cartesian3());
                    destination = Cartesian3.add(targetPosition, offsetWC, new Cartesian3());

                    orientation = {
                        heading: headingRad,
                        pitch: pitch,
                        roll: 0
                    };
                } else {
                    // Offset backwards by its looking direction
                    const offset = Cartesian3.multiplyByScalar(direction, -viewDistance, new Cartesian3());
                    destination = Cartesian3.add(targetPosition, offset, new Cartesian3());

                    // Keep roll at 0 by using the Earth's local normal to force a horizontal right vector
                    const localUp = Ellipsoid.WGS84.geodeticSurfaceNormal(destination, new Cartesian3());
                    const right = Cartesian3.cross(direction, localUp, new Cartesian3());
                    Cartesian3.normalize(right, right);

                    // The new 'up' vector will be perpendicular to both, ensuring 0 roll
                    const up = Cartesian3.cross(right, direction, new Cartesian3());
                    Cartesian3.normalize(up, up);

                    orientation = {
                        direction: direction,
                        up: up,
                    };
                }

                viewer.camera.flyTo({
                    destination: destination,
                    orientation: orientation,
                    duration: 1.5,
                });
            }, 50);
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

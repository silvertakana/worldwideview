"use client";

import React, { useEffect, useRef, useCallback, useMemo, useState } from "react";
import {
    Viewer,
    Entity,
    BillboardGraphics,
    PointGraphics,
    LabelGraphics,
} from "resium";
import {
    Ion,
    GeoJsonDataSource,
    createGooglePhotorealistic3DTileset,
    Cartesian3,
    Color,
    VerticalOrigin,
    HorizontalOrigin,
    NearFarScalar,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    defined,
    Math as CesiumMath,
    JulianDate,
    PointPrimitiveCollection,
    BillboardCollection,
    LabelCollection,
    Ellipsoid,
    CullingVolume,
    BoundingSphere,
    Intersect,
    IonImageryProvider,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import { useStore } from "@/core/state/store";
import { dataBus } from "@/core/data/DataBus";
import { pluginManager } from "@/core/plugins/PluginManager";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";

// Set Cesium Ion token
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_CESIUM_TOKEN) {
    Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_TOKEN;
}

// Camera presets
const CAMERA_PRESETS: Record<string, { lat: number; lon: number; alt: number; heading: number; pitch: number }> = {
    global: { lat: 20, lon: 0, alt: 20000000, heading: 0, pitch: -90 },
    americas: { lat: 15, lon: -80, alt: 12000000, heading: 0, pitch: -80 },
    europe: { lat: 50, lon: 15, alt: 6000000, heading: 0, pitch: -75 },
    mena: { lat: 28, lon: 42, alt: 6000000, heading: 0, pitch: -75 },
    asiaPacific: { lat: 30, lon: 105, alt: 10000000, heading: 0, pitch: -80 },
    africa: { lat: 2, lon: 22, alt: 8000000, heading: 0, pitch: -80 },
    oceania: { lat: -25, lon: 140, alt: 7000000, heading: 0, pitch: -75 },
    arctic: { lat: 80, lon: 0, alt: 6000000, heading: 0, pitch: -85 },
};

function getEntityColor(entity: GeoEntity, options: CesiumEntityOptions): Color {
    if (options.color) {
        return Color.fromCssColorString(options.color);
    }
    return Color.CYAN;
}


export default function GlobeView() {
    const viewerRef = useRef<CesiumViewer | null>(null);
    const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
    const [viewerReady, setViewerReady] = useState(false);
    const setSelectedEntity = useStore((s) => s.setSelectedEntity);
    const entitiesByPlugin = useStore((s) => s.entitiesByPlugin);
    const layers = useStore((s) => s.layers);
    const showLabels = useStore((s) => s.mapConfig.showLabels);
    const labelsLayerRef = useRef<import("cesium").ImageryLayer | null>(null);

    // Collect all visible entities (memoized to avoid unnecessary effect re-runs)
    const visibleEntities = useMemo(() => {
        const result: Array<{ entity: GeoEntity; options: CesiumEntityOptions }> = [];
        pluginManager.getAllPlugins().forEach((managed) => {
            if (!layers[managed.plugin.id]?.enabled) return;
            const entities = entitiesByPlugin[managed.plugin.id] || [];
            entities.forEach((entity) => {
                const options = managed.plugin.renderEntity(entity);
                result.push({ entity, options });
            });
        });
        return result;
    }, [layers, entitiesByPlugin]);

    // Fly to camera preset
    const flyToPreset = useCallback((presetId: string) => {
        const preset = CAMERA_PRESETS[presetId];
        if (!preset || !viewerRef.current) return;
        viewerRef.current.camera.flyTo({
            destination: Cartesian3.fromDegrees(preset.lon, preset.lat, preset.alt),
            orientation: {
                heading: CesiumMath.toRadians(preset.heading),
                pitch: CesiumMath.toRadians(preset.pitch),
                roll: 0,
            },
            duration: 2.5,
        });
    }, []);

    // Listen for camera preset events
    useEffect(() => {
        const unsub = dataBus.on("cameraPreset", ({ presetId }) => {
            flyToPreset(presetId);
        });
        return unsub;
    }, [flyToPreset]);

    // Handle camera position changes from store
    const cameraLat = useStore((s) => s.cameraLat);
    const cameraLon = useStore((s) => s.cameraLon);
    const cameraAlt = useStore((s) => s.cameraAlt);
    const cameraHeading = useStore((s) => s.cameraHeading);
    const cameraPitch = useStore((s) => s.cameraPitch);

    useEffect(() => {
        if (!viewerRef.current) return;

        // Use flyTo for smooth movement
        viewerRef.current.camera.flyTo({
            destination: Cartesian3.fromDegrees(cameraLon, cameraLat, cameraAlt),
            orientation: {
                heading: CesiumMath.toRadians(cameraHeading),
                pitch: CesiumMath.toRadians(cameraPitch),
                roll: 0,
            },
            duration: 2.0,
        });
    }, [cameraLat, cameraLon, cameraAlt, cameraHeading, cameraPitch]);

    // Set up click handler for entity selection
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        handlerRef.current = new ScreenSpaceEventHandler(viewer.scene.canvas);
        handlerRef.current.setInputAction(
            (event: { position: { x: number; y: number } }) => {
                const picked = viewer.scene.pick(event.position as import("cesium").Cartesian2);
                if (defined(picked) && picked.id && picked.id._wwvEntity) {
                    setSelectedEntity(picked.id._wwvEntity as GeoEntity);
                } else {
                    setSelectedEntity(null);
                }
            },
            ScreenSpaceEventType.LEFT_CLICK
        );

        return () => {
            handlerRef.current?.destroy();
        };
    }, [setSelectedEntity]);

    // Handle Labels & Custom Borders Layer
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        // Ensure globe stays hidden (we only need it for draping if required)
        viewer.scene.globe.show = false;

        if (showLabels) {
            // Add the label imagery layer if not already present
            if (!labelsLayerRef.current) {
                IonImageryProvider.fromAssetId(2411391).then((provider) => {
                    if (!viewerRef.current || !showLabels) return;
                    labelsLayerRef.current = viewer.imageryLayers.addImageryProvider(provider);
                });
            }
            // Load custom border GeoJSON (once)
            if (!viewer.dataSources.get(0)) {
                GeoJsonDataSource.load('/borders.geojson', {
                    clampToGround: true,
                    stroke: Color.CYAN.withAlpha(0.6),
                    strokeWidth: 1.5,
                    fill: Color.TRANSPARENT,
                }).then((ds) => {
                    const viewer = viewerRef.current;
                    if (viewer) {
                        viewer.dataSources.add(ds);
                    }
                }).catch((err) => {
                    console.warn('[GlobeView] Failed to load borders GeoJSON', err);
                });
            }
        } else {
            // Remove label layer
            if (labelsLayerRef.current) {
                viewer.imageryLayers.remove(labelsLayerRef.current);
                labelsLayerRef.current = null;
            }
            // Remove border data source
            const ds = viewer.dataSources.get(0);
            if (ds) {
                viewer.dataSources.remove(ds);
            }
        }
    }, [showLabels]);

    // Init Google 3D tiles
    const handleViewerReady = useCallback(async (viewer: CesiumViewer) => {
        viewerRef.current = viewer;

        // Performance optimizations
        viewer.scene.requestRenderMode = false; // Disabled to allow dynamic entity updates
        viewer.scene.maximumRenderTimeChange = Infinity;
        viewer.scene.debugShowFramesPerSecond = false;

        // Remove default imagery/terrain
        viewer.scene.globe.show = false;

        // Add Google Photorealistic 3D Tiles
        try {
            const tileset = await createGooglePhotorealistic3DTileset({
                key: process.env.GOOGLE_MAPS_API_KEY || undefined,
            });
            viewer.scene.primitives.add(tileset);
        } catch (err) {
            console.warn("[GlobeView] Failed to load Google 3D Tiles, falling back to default globe:", err);
            viewer.scene.globe.show = true;
        }

        // Initialize empty collections on the viewer for reuse
        (viewer as any)._wwvPoints = viewer.scene.primitives.add(new PointPrimitiveCollection());
        (viewer as any)._wwvBillboards = viewer.scene.primitives.add(new BillboardCollection());
        (viewer as any)._wwvLabels = viewer.scene.primitives.add(new LabelCollection());

        // Set initial camera position
        viewer.camera.setView({
            destination: Cartesian3.fromDegrees(0, 20, 20000000),
        });

        // Signal that the viewer is ready — this triggers the rendering effect
        setViewerReady(true);
    }, []);

    // Native Cesium Rendering for Entities
    // NOTE: viewerReady is in deps so this effect re-runs once the viewer initialises,
    // ensuring entities that loaded before the viewer was ready get rendered.
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !viewerReady) return;

        const points = (viewer as any)._wwvPoints as import("cesium").PointPrimitiveCollection;
        const billboards = (viewer as any)._wwvBillboards as import("cesium").BillboardCollection;
        const labels = (viewer as any)._wwvLabels as import("cesium").LabelCollection;

        if (!points || !billboards || !labels) return;

        points.removeAll();
        billboards.removeAll();
        labels.removeAll();

        const positionMap = new Map<any, import("cesium").Cartesian3>();
        const animatables: Array<{ primitive: any; entity: GeoEntity; isLabel?: boolean }> = [];

        for (const { entity, options } of visibleEntities) {
            const position = Cartesian3.fromDegrees(
                entity.longitude,
                entity.latitude,
                entity.altitude || 0
            );
            const color = getEntityColor(entity, options);
            const clickId = { _wwvEntity: entity };

            let addedPrimitive: any;

            if (options.type === "billboard" && options.iconUrl) {
                addedPrimitive = billboards.add({
                    position,
                    image: options.iconUrl,
                    scale: 0.5,
                    verticalOrigin: VerticalOrigin.CENTER,
                    horizontalOrigin: HorizontalOrigin.CENTER,
                    rotation: options.rotation
                        ? -CesiumMath.toRadians(options.rotation)
                        : 0,
                    color,
                    scaleByDistance: new NearFarScalar(1e3, 1.0, 1e7, 0.3),
                    id: clickId,
                });
            } else {
                addedPrimitive = points.add({
                    position,
                    pixelSize: options.size || 6,
                    color,
                    outlineColor: options.outlineColor
                        ? Color.fromCssColorString(options.outlineColor)
                        : Color.BLACK,
                    outlineWidth: options.outlineWidth || 1,
                    scaleByDistance: new NearFarScalar(1e3, 1.0, 1e7, 0.4),
                    id: clickId,
                });
            }
            positionMap.set(addedPrimitive, position);

            if (options.labelText) {
                const addedLabel = labels.add({
                    position,
                    text: options.labelText,
                    font: options.labelFont || "12px Inter, sans-serif",
                    fillColor: Color.WHITE,
                    outlineColor: Color.BLACK,
                    outlineWidth: 2,
                    verticalOrigin: VerticalOrigin.BOTTOM,
                    pixelOffset: { x: 0, y: -12 } as any,
                    scaleByDistance: new NearFarScalar(1e3, 1.0, 5e6, 0.0),
                    id: clickId,
                });
                positionMap.set(addedLabel, position);
            }

            animatables.push({ primitive: addedPrimitive, entity });
            if (options.labelText) {
                animatables.push({ primitive: labels.get(labels.length - 1), entity, isLabel: true });
            }
        }

        // --- Animation Loop ---
        const updatePositions = () => {
            if (!viewerRef.current) return;
            const state = useStore.getState();
            // Use current time from timeline if in playback, or clock time if live (to prevent stuttering)
            const nowMs = state.isPlaybackMode ? state.currentTime.getTime() : Date.now();

            for (let i = 0; i < animatables.length; i++) {
                const { primitive, entity, isLabel } = animatables[i];
                if (!entity.timestamp || entity.speed === undefined || entity.heading === undefined) continue;

                // Calculate time difference in seconds. Can be negative in playback if nowMs is before the snapshot timestamp.
                const dtSec = (nowMs - entity.timestamp.getTime()) / 1000;

                // Allow extrapolation up to 5 minutes forward or backward
                if (Math.abs(dtSec) <= 300 && primitive) {
                    const distanceM = entity.speed * dtSec;
                    const angularDist = distanceM / 6371000;

                    const lat1 = CesiumMath.toRadians(entity.latitude);
                    const lon1 = CesiumMath.toRadians(entity.longitude);
                    const brng = CesiumMath.toRadians(entity.heading);

                    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angularDist) + Math.cos(lat1) * Math.sin(angularDist) * Math.cos(brng));
                    const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(angularDist) * Math.cos(lat1), Math.cos(angularDist) - Math.sin(lat1) * Math.sin(lat2));

                    const newPos = Cartesian3.fromRadians(lon2, lat2, entity.altitude || 0);
                    primitive.position = newPos;
                    positionMap.set(primitive, newPos);
                }
            }
        };

        viewer.scene.preUpdate.addEventListener(updatePositions);

        // --- Culling Logic ---
        viewer.camera.percentageChanged = 0.05;

        const updateVisibility = () => {
            if (!viewerRef.current) return;
            const cam = viewerRef.current.camera;

            // Check frustom culling
            const cullingVolume = cam.frustum.computeCullingVolume(cam.positionWC, cam.directionWC, cam.upWC);

            const scratchSphere = new BoundingSphere(new Cartesian3(), 10.0); // Allow slight padding

            // For Horizon Culling
            const camPos = cam.positionWC;
            const R_WGS84_MIN = 6356752.0; // Safe underestimate for occlusion
            const R2 = R_WGS84_MIN * R_WGS84_MIN;
            const camDistSqr = Cartesian3.magnitudeSquared(camPos);
            const Dh = Math.sqrt(Math.max(0, camDistSqr - R2));

            const updatePrimitiveVisibility = (primitiveInfo: any) => {
                const pos = positionMap.get(primitiveInfo);
                if (!pos) return;

                // 1. Horizon Culling (Spherical tangent distance)
                // The max line-of-sight distance without hitting the Earth is Dh + Dph.
                const posDistSqr = Cartesian3.magnitudeSquared(pos);
                const Dph = Math.sqrt(Math.max(0, posDistSqr - R2));
                const distanceToPoint = Cartesian3.distance(camPos, pos);

                if (distanceToPoint > Dh + Dph) {
                    primitiveInfo.show = false;
                    return;
                }

                // 2. Frustum Culling
                scratchSphere.center = pos;
                const intersection = cullingVolume.computeVisibility(scratchSphere);
                primitiveInfo.show = intersection !== Intersect.OUTSIDE;
            };

            for (let i = 0; i < points.length; ++i) {
                updatePrimitiveVisibility(points.get(i));
            }
            for (let i = 0; i < billboards.length; ++i) {
                updatePrimitiveVisibility(billboards.get(i));
            }
            for (let i = 0; i < labels.length; ++i) {
                updatePrimitiveVisibility(labels.get(i));
            }
        };

        // Run initially once
        updateVisibility();

        // Attach listeners
        viewer.camera.changed.addEventListener(updateVisibility);

        return () => {
            if (viewer && !viewer.isDestroyed()) {
                viewer.camera.changed.removeEventListener(updateVisibility);
                viewer.scene.preUpdate.removeEventListener(updatePositions);
            }
        };
    }, [visibleEntities, viewerReady]);

    return (
        <Viewer
            full
            ref={(e) => {
                if (e?.cesiumElement && !viewerRef.current) {
                    handleViewerReady(e.cesiumElement);
                }
            }}
            animation={false}
            baseLayerPicker={false}
            fullscreenButton={false}
            geocoder={false}
            homeButton={false}
            infoBox={false}
            navigationHelpButton={false}
            sceneModePicker={false}
            selectionIndicator={false}
            timeline={false}
            vrButton={false}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
    );
}

import { useEffect } from "react";
import {
    GroundPolylinePrimitive,
    GroundPolylineGeometry,
    GeometryInstance,
    PolylineMaterialAppearance,
    Material,
    Color,
    Cartesian3,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";

export function useRegionOutline(
    viewer: CesiumViewer | null,
    viewerReady: boolean,
) {
    useEffect(() => {
        if (!viewer || viewer.isDestroyed() || !viewerReady) return;

        let primitive: GroundPolylinePrimitive | null = null;
        let cancelled = false;

        async function load() {
            const res = await fetch("/api/texas/boundary");
            if (!res.ok || cancelled) return;
            const geojson = await res.json();
            if (cancelled || !viewer || viewer.isDestroyed()) return;

            const feature = geojson.features?.[0];
            if (!feature) return;

            const { type, coordinates } = feature.geometry;
            const rings: number[][][] = type === "Polygon"
                ? [coordinates[0]]
                : (coordinates as number[][][][]).map((poly) => poly[0]);

            const instances = rings.map((ring) =>
                new GeometryInstance({
                    geometry: new GroundPolylineGeometry({
                        positions: Cartesian3.fromDegreesArray(ring.flat()),
                        width: 3.0,
                    }),
                })
            );

            primitive = new GroundPolylinePrimitive({
                geometryInstances: instances,
                appearance: new PolylineMaterialAppearance({
                    material: Material.fromType("Color", {
                        color: Color.fromCssColorString("#ffffff").withAlpha(0.9),
                    }),
                }),
            });

            if (cancelled || !viewer || viewer.isDestroyed()) return;
            viewer.scene.groundPrimitives.add(primitive);
            viewer.scene.requestRender();
        }

        load().catch((e) => console.error("[RegionOutline] failed:", e));

        return () => {
            cancelled = true;
            if (primitive && viewer && !viewer.isDestroyed()) {
                viewer.scene.groundPrimitives.remove(primitive);
            }
        };
    }, [viewer, viewerReady]);
}

import {
    GeoJsonDataSource,
    Color,
    JulianDate,
    BoundingSphere,
    Cartographic,
    Cartesian3,
    LabelGraphics,
    PolylineGraphics,
    LabelStyle,
    VerticalOrigin,
    HorizontalOrigin,
    DistanceDisplayCondition,
    NearFarScalar,
    ClassificationType,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";

/**
 * Loads and manages GeoJSON country borders and labels on the Cesium viewer.
 */
export class BordersManager {
    private dataSource: import("cesium").GeoJsonDataSource | null = null;

    /**
     * Show borders — loads GeoJSON on first call, re-adds on subsequent calls.
     */
    async show(viewer: CesiumViewer): Promise<void> {
        if (!this.dataSource) {
            try {
                const ds = await GeoJsonDataSource.load("/borders.geojson", {
                    clampToGround: true,
                    stroke: Color.CYAN.withAlpha(0.6),
                    strokeWidth: 1.5,
                    fill: Color.TRANSPARENT,
                });

                this.addLabelsAndPolylines(ds);
                this.dataSource = ds;
                viewer.dataSources.add(ds);
            } catch (err) {
                console.warn("[BordersManager] Failed to load borders GeoJSON", err);
            }
        } else if (!viewer.dataSources.contains(this.dataSource)) {
            viewer.dataSources.add(this.dataSource);
        }
    }

    /**
     * Hide borders by removing the data source (without destroying it).
     */
    hide(viewer: CesiumViewer): void {
        if (this.dataSource && viewer.dataSources.contains(this.dataSource)) {
            viewer.dataSources.remove(this.dataSource, false);
        }
    }

    /**
     * Iterates loaded entities and adds labels + border polylines.
     */
    private addLabelsAndPolylines(ds: GeoJsonDataSource): void {
        const entities = ds.entities.values;
        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            if (!entity.name || !entity.polygon) continue;

            const hierarchy = entity.polygon.hierarchy?.getValue(JulianDate.now());
            if (!hierarchy) continue;

            const positions = hierarchy.positions;
            if (!positions || positions.length === 0) continue;

            // Label at polygon center
            const center = BoundingSphere.fromPoints(positions).center;
            const cartographic = Cartographic.fromCartesian(center);
            cartographic.height = 1000;

            entity.position = Cartesian3.fromRadians(
                cartographic.longitude,
                cartographic.latitude,
                cartographic.height
            ) as any;

            entity.label = new LabelGraphics({
                text: entity.name,
                font: "bold 14px Inter, sans-serif",
                fillColor: Color.WHITE,
                outlineColor: Color.BLACK.withAlpha(0.8),
                outlineWidth: 3,
                style: LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: VerticalOrigin.CENTER,
                horizontalOrigin: HorizontalOrigin.CENTER,
                distanceDisplayCondition: new DistanceDisplayCondition(10.0, 8000000.0),
                scaleByDistance: new NearFarScalar(1.5e6, 1.2, 8e6, 0.0),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            });

            // Border polyline (clamped to ground/3D tiles)
            entity.polyline = new PolylineGraphics({
                positions: [...positions, positions[0]],
                width: 1.5,
                material: Color.CYAN.withAlpha(0.5),
                clampToGround: true,
                classificationType: ClassificationType.BOTH,
            });

            // Hide original polygon fill
            entity.polygon.show = false as any;
        }
    }
}

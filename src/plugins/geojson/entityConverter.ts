/**
 * Converts GeoJSON features to GeoEntity[] for the plugin system.
 * Handles Point, LineString, and Polygon geometries by extracting
 * a representative point (centroid or first coordinate).
 */

import type { GeoEntity } from "@/core/plugins/PluginTypes";
import type { GeoJsonFeature, GeoJsonGeometry } from "@/types/geojson";

/** Extract a representative [lat, lon, alt?] from any geometry. */
function representativePoint(
    geom: GeoJsonGeometry,
): { lat: number; lon: number; alt?: number } {
    switch (geom.type) {
        case "Point": {
            const [lon, lat, alt] = geom.coordinates;
            return { lat, lon, ...(alt !== undefined ? { alt } : {}) };
        }
        case "MultiPoint":
        case "LineString": {
            const first = geom.coordinates[0] as number[];
            return { lat: first[1], lon: first[0] };
        }
        case "Polygon":
        case "MultiLineString": {
            const ring = geom.coordinates[0] as number[][];
            return { lat: ring[0][1], lon: ring[0][0] };
        }
        case "MultiPolygon": {
            const poly = geom.coordinates[0] as number[][][];
            return { lat: poly[0][0][1], lon: poly[0][0][0] };
        }
        default:
            return { lat: 0, lon: 0 };
    }
}

export function featuresToEntities(
    features: GeoJsonFeature[],
    layerId: string,
): GeoEntity[] {
    return features.map((feature, index) => {
        const point = representativePoint(feature.geometry);
        const featureId = feature.id ?? index;

        return {
            id: `${layerId}-${featureId}`,
            pluginId: "geojson-importer",
            latitude: point.lat,
            longitude: point.lon,
            altitude: point.alt,
            timestamp: new Date(),
            label: (feature.properties.name as string) ?? undefined,
            properties: {
                ...feature.properties,
                _layerId: layerId,
                _geometryType: feature.geometry.type,
            },
        };
    });
}

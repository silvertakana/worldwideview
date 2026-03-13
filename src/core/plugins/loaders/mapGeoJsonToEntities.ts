import type { GeoEntity } from "../PluginTypes";
import type { FieldMapping } from "../PluginManifest";
import { getNestedValue } from "./getNestedValue";

interface GeoJsonFeature {
    id?: string | number;
    geometry: { type: string; coordinates: number[] };
    properties: Record<string, unknown>;
}

/**
 * Maps a GeoJSON response to GeoEntity[].
 * Expects `data.features` to be an array of GeoJSON Feature objects.
 */
export function mapGeoJsonToEntities(
    data: unknown,
    mapping: FieldMapping,
    pluginId: string,
): GeoEntity[] {
    const obj = data as Record<string, unknown>;
    const features = (obj?.features ?? []) as GeoJsonFeature[];
    if (!Array.isArray(features)) return [];

    return features
        .filter((f) => f.geometry?.coordinates?.length >= 2)
        .map((f, i): GeoEntity => {
            const coords = f.geometry.coordinates;
            return {
                id: `${pluginId}-${f.id ?? i}`,
                pluginId,
                longitude: coords[0],
                latitude: coords[1],
                altitude: coords[2] ?? undefined,
                heading: asNumber(getNestedValue(f, mapping.heading ?? "")),
                speed: asNumber(getNestedValue(f, mapping.speed ?? "")),
                timestamp: parseTimestamp(getNestedValue(f, mapping.timestamp ?? "")),
                label: asString(getNestedValue(f, mapping.label ?? "")),
                properties: extractProperties(f, mapping),
            };
        });
}

function extractProperties(
    item: unknown,
    mapping: FieldMapping,
): Record<string, unknown> {
    if (!mapping.properties) return {};
    const result: Record<string, unknown> = {};
    for (const [key, path] of Object.entries(mapping.properties)) {
        result[key] = getNestedValue(item, path);
    }
    return result;
}

function asNumber(val: unknown): number | undefined {
    if (val == null) return undefined;
    const n = Number(val);
    return Number.isFinite(n) ? n : undefined;
}

function asString(val: unknown): string | undefined {
    if (val == null) return undefined;
    return String(val);
}

function parseTimestamp(val: unknown): Date {
    if (val instanceof Date) return val;
    if (typeof val === "number") return new Date(val);
    if (typeof val === "string") {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
    }
    return new Date();
}

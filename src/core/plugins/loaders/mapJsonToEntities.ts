import type { GeoEntity } from "../PluginTypes";
import type { FieldMapping } from "../PluginManifest";
import { getNestedValue } from "./getNestedValue";

/**
 * Maps a plain JSON response to GeoEntity[].
 * Uses dot-path field mapping to extract each field from each item.
 */
export function mapJsonToEntities(
    data: unknown,
    mapping: FieldMapping,
    pluginId: string,
    arrayPath?: string,
): GeoEntity[] {
    const items = resolveArray(data, arrayPath);
    if (!Array.isArray(items)) return [];

    return items
        .map((item, i) => itemToEntity(item, i, mapping, pluginId))
        .filter((e): e is GeoEntity => e !== null);
}

function resolveArray(data: unknown, arrayPath?: string): unknown[] {
    if (Array.isArray(data)) return data;
    if (!arrayPath) return [];
    const resolved = getNestedValue(data, arrayPath);
    return Array.isArray(resolved) ? resolved : [];
}

function itemToEntity(
    item: unknown,
    index: number,
    mapping: FieldMapping,
    pluginId: string,
): GeoEntity | null {
    const lat = asNumber(getNestedValue(item, mapping.latitude));
    const lon = asNumber(getNestedValue(item, mapping.longitude));
    if (lat == null || lon == null) return null;

    const rawId = getNestedValue(item, mapping.id);
    return {
        id: `${pluginId}-${rawId ?? index}`,
        pluginId,
        latitude: lat,
        longitude: lon,
        altitude: asNumber(getNestedValue(item, mapping.altitude ?? "")),
        heading: asNumber(getNestedValue(item, mapping.heading ?? "")),
        speed: asNumber(getNestedValue(item, mapping.speed ?? "")),
        timestamp: parseTimestamp(getNestedValue(item, mapping.timestamp ?? "")),
        label: asString(getNestedValue(item, mapping.label ?? "")),
        properties: extractProperties(item, mapping),
    };
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

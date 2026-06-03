import type { GeoEntity } from "@worldwideview/wwv-plugin-sdk";
import type {
    SearchResult,
    RegionOptions,
    DetailResult,
    PluginDataSnapshot,
} from "./types";

function getEngineUrl(): string {
    return process.env.NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL ?? "http://localhost:5000";
}

function normalizeEntity(raw: unknown): GeoEntity | null {
    if (typeof raw !== "object" || raw === null) return null;
    const e = raw as Record<string, unknown>;
    return {
        id: e.id as string,
        pluginId: e.pluginId as string,
        latitude: e.latitude as number,
        longitude: e.longitude as number,
        altitude: e.altitude as number | undefined,
        heading: e.heading as number | undefined,
        speed: e.speed as number | undefined,
        timestamp: new Date((e.timestamp as string | Date | undefined) ?? Date.now()),
        label: e.label as string | undefined,
        properties: (e.properties as Record<string, unknown>) ?? {},
    };
}

/** Validate that a pluginId is safe to embed in a URL path segment. */
function validatePluginId(pluginId: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(pluginId)) {
        throw new Error("Invalid pluginId: only alphanumeric characters, hyphens, and underscores are allowed");
    }
    return pluginId;
}

async function fetchPluginSnapshot(pluginId: string): Promise<PluginDataSnapshot | null> {
    const safeId = validatePluginId(pluginId);
    const engineBase = getEngineUrl();
    const url = new URL(`/api/${safeId}`, engineBase).toString();
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.status === 404) return null;
        if (!res.ok) {
            console.error("[data-query] Engine returned", res.status, "for plugin");
            return null;
        }
        const data: unknown = await res.json();
        const raw = Array.isArray(data) ? data : ((data as Record<string, unknown>)?.items ?? []) as unknown[];
        const entities: GeoEntity[] = (raw as unknown[]).reduce<GeoEntity[]>((acc, item) => {
            const entity = normalizeEntity(item);
            if (entity !== null) acc.push(entity);
            return acc;
        }, []);
        return { pluginId: safeId, entities, timestamp: new Date() };
    } catch (err) {
        console.error("[data-query] Failed to fetch plugin snapshot:", err);
        return null;
    }
}

async function getAllPluginSnapshots(): Promise<PluginDataSnapshot[]> {
    const url = `${getEngineUrl()}/manifest`;
    let pluginIds: string[] = [];
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) {
            console.error(`[data-query] Manifest fetch returned ${res.status}`);
            return [];
        }
        const data: unknown = await res.json();
        pluginIds = ((data as Record<string, unknown>)?.plugins as string[]) ?? [];
    } catch (err) {
        console.error("[data-query] Failed to fetch manifest:", err);
        return [];
    }

    const results = await Promise.allSettled(pluginIds.map(fetchPluginSnapshot));
    return results.reduce<PluginDataSnapshot[]>((acc, result) => {
        if (result.status === "fulfilled" && result.value !== null) {
            acc.push(result.value);
        }
        return acc;
    }, []);
}

function entityToSearchResult(entity: GeoEntity): SearchResult {
    return {
        id: entity.id,
        pluginId: entity.pluginId,
        name: entity.label ?? entity.id,
        latitude: entity.latitude,
        longitude: entity.longitude,
    };
}

export async function searchEntities(
    query: string,
    pluginId?: string,
    limit: number = 20,
): Promise<SearchResult[]> {
    const trimmed = query.trim();
    if (trimmed === "") return [];

    const effectiveLimit = Math.min(Math.max(limit, 1), 100);
    const lower = trimmed.toLowerCase();

    const snapshots = pluginId
        ? await fetchPluginSnapshot(pluginId).then((s) => (s ? [s] : []))
        : await getAllPluginSnapshots();

    const results: SearchResult[] = [];
    for (const snapshot of snapshots) {
        for (const entity of snapshot.entities) {
            if (results.length >= effectiveLimit) break;
            const matchTarget = (entity.label ?? entity.id).toLowerCase();
            if (matchTarget.includes(lower)) {
                results.push(entityToSearchResult(entity));
            }
        }
        if (results.length >= effectiveLimit) break;
    }
    return results;
}

export async function getEntitiesInRegion(bounds: RegionOptions): Promise<SearchResult[]> {
    const { north, south, east, west } = bounds;
    if (isNaN(north) || isNaN(south) || isNaN(east) || isNaN(west)) {
        throw new Error("Invalid bounding box: north/south/east/west must all be numbers");
    }

    const effectiveLimit = Math.min(bounds.limit ?? 100, 1000);
    const isAntimeridian = east < west;

    const snapshots = bounds.pluginId
        ? await fetchPluginSnapshot(bounds.pluginId).then((s) => (s ? [s] : []))
        : await getAllPluginSnapshots();

    const results: SearchResult[] = [];
    for (const snapshot of snapshots) {
        for (const entity of snapshot.entities) {
            if (results.length >= effectiveLimit) break;
            const { latitude: lat, longitude: lon } = entity;
            if (lat < south || lat > north) continue;
            const inLon = isAntimeridian
                ? lon >= west || lon <= east
                : lon >= west && lon <= east;
            if (inLon) results.push(entityToSearchResult(entity));
        }
        if (results.length >= effectiveLimit) break;
    }
    return results;
}

export async function getEntityDetails(
    pluginId: string,
    entityId: string,
): Promise<DetailResult | null> {
    const snapshot = await fetchPluginSnapshot(pluginId);
    if (!snapshot) return null;

    const entity = snapshot.entities.find((e) => e.id === entityId);
    if (!entity) return null;

    return {
        id: entity.id,
        pluginId: entity.pluginId,
        latitude: entity.latitude,
        longitude: entity.longitude,
        altitude: entity.altitude,
        heading: entity.heading,
        speed: entity.speed,
        timestamp: entity.timestamp,
        label: entity.label,
        properties: entity.properties,
    };
}

export async function getPluginData(pluginId: string): Promise<PluginDataSnapshot | null> {
    if (!pluginId.trim()) return null;
    try {
        return fetchPluginSnapshot(pluginId);
    } catch {
        return null;
    }
}

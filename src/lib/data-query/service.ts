import type { GeoEntity } from "@worldwideview/wwv-plugin-sdk";
import type {
    SearchResult,
    RegionOptions,
    DetailResult,
    PluginDataSnapshot,
    QueryResult,
    SingleResult,
} from "./types";
import { matchFilterValue } from "@/core/filters/matchFilterValue";
import type { FilterValue } from "@/core/plugins/PluginTypes";
import { hasLocalSource, resolveLocalSnapshot, getLocalSourceIds } from "./localSources";

export function getEngineUrl(): string {
    const port = process.env.NEXT_PUBLIC_WWV_LOCAL_ENGINE_PORT || '5001';
    return `http://localhost:${port}`;
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

/**
 * Private helper: attempt to fetch a plugin snapshot from the data engine.
 * Returns null on 404, non-2xx, or network failure.
 * Validation of pluginId is the caller's responsibility.
 */
async function fetchEngineSnapshot(safeId: string): Promise<PluginDataSnapshot | null> {
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

/**
 * Fetch a snapshot for the given pluginId.
 * Resolution order (D-08):
 *   1. Data engine (engine-first, real-time data).
 *   2. Local registry (server-side static/client-side sources that have no engine endpoint).
 *   3. null — the pluginId is genuinely unknown; callers map this to "plugin_not_streaming".
 */
export async function fetchPluginSnapshot(pluginId: string): Promise<PluginDataSnapshot | null> {
    const safeId = validatePluginId(pluginId);

    const engineSnapshot = await fetchEngineSnapshot(safeId);
    if (engineSnapshot !== null) return engineSnapshot;

    if (await hasLocalSource(safeId)) {
        return resolveLocalSnapshot(safeId);
    }

    return null;
}

export async function getAllPluginSnapshots(): Promise<PluginDataSnapshot[]> {
    const manifestUrl = `${getEngineUrl()}/manifest`;
    let enginePluginIds: string[] = [];
    try {
        const res = await fetch(manifestUrl, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) {
            console.error(`[data-query] Manifest fetch returned ${res.status}`);
        } else {
            const data: unknown = await res.json();
            enginePluginIds = ((data as Record<string, unknown>)?.plugins as string[]) ?? [];
        }
    } catch (err) {
        console.error("[data-query] Failed to fetch manifest:", err);
    }

    // Union engine ids with local-registry ids; dedupe using a Set so a pluginId
    // present in both resolves only once (engine-first ordering is preserved
    // because engine ids come first in the Set iteration).
    const localIds = Array.from(await getLocalSourceIds());
    const allIds = Array.from(new Set([...enginePluginIds, ...localIds]));

    const results = await Promise.allSettled(allIds.map(fetchPluginSnapshot));
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
    filters?: Record<string, FilterValue>,
): Promise<QueryResult<SearchResult>> {
    const trimmed = query.trim();
    if (trimmed === "") return { entities: [], emptyReason: "no_data_matches" };

    const effectiveLimit = Math.min(Math.max(limit, 1), 100);
    const lower = trimmed.toLowerCase();
    const filterEntries = filters ? Object.entries(filters) : null;

    // Determine if the plugin is known to the engine (streaming check).
    let snapshotNotStreaming = false;
    let snapshots: PluginDataSnapshot[];
    if (pluginId) {
        const s = await fetchPluginSnapshot(pluginId);
        if (s === null) {
            return { entities: [], emptyReason: "plugin_not_streaming" };
        }
        snapshots = [s];
    } else {
        snapshots = await getAllPluginSnapshots();
        // When no pluginId filter: 0 snapshots means engine has no active plugins.
        if (snapshots.length === 0) {
            snapshotNotStreaming = true;
        }
    }

    const results: SearchResult[] = [];
    for (const snapshot of snapshots) {
        for (const entity of snapshot.entities) {
            if (results.length >= effectiveLimit) break;
            const matchTarget = (entity.label ?? entity.id).toLowerCase();
            if (!matchTarget.includes(lower)) continue;
            // Apply inline filters on the full GeoEntity.properties BEFORE
            // entityToSearchResult conversion (which drops properties). D-07.
            if (filterEntries) {
                const ok = filterEntries.every(([key, fv]) =>
                    matchFilterValue(entity.properties[key], fv),
                );
                if (!ok) continue;
            }
            results.push(entityToSearchResult(entity));
        }
        if (results.length >= effectiveLimit) break;
    }

    if (results.length === 0) {
        return {
            entities: [],
            emptyReason: snapshotNotStreaming ? "plugin_not_streaming" : "no_data_matches",
        };
    }
    return { entities: results };
}

export async function getEntitiesInRegion(bounds: RegionOptions): Promise<QueryResult<SearchResult>> {
    const { north, south, east, west } = bounds;
    if (isNaN(north) || isNaN(south) || isNaN(east) || isNaN(west)) {
        throw new Error("Invalid bounding box: north/south/east/west must all be numbers");
    }

    const effectiveLimit = Math.min(bounds.limit ?? 100, 1000);
    const isAntimeridian = east < west;

    let snapshotNotStreaming = false;
    let snapshots: PluginDataSnapshot[];
    if (bounds.pluginId) {
        const s = await fetchPluginSnapshot(bounds.pluginId);
        if (s === null) {
            return { entities: [], emptyReason: "plugin_not_streaming" };
        }
        snapshots = [s];
    } else {
        snapshots = await getAllPluginSnapshots();
        if (snapshots.length === 0) {
            snapshotNotStreaming = true;
        }
    }

    // Collect all matches first to get a totalMatched count, then cap.
    const allMatched: SearchResult[] = [];
    for (const snapshot of snapshots) {
        for (const entity of snapshot.entities) {
            const { latitude: lat, longitude: lon } = entity;
            if (lat < south || lat > north) continue;
            const inLon = isAntimeridian
                ? lon >= west || lon <= east
                : lon >= west && lon <= east;
            if (inLon) allMatched.push(entityToSearchResult(entity));
        }
    }

    if (allMatched.length === 0) {
        return {
            entities: [],
            emptyReason: snapshotNotStreaming ? "plugin_not_streaming" : "no_data_matches",
        };
    }

    const truncated = allMatched.length > effectiveLimit;
    const results = truncated ? allMatched.slice(0, effectiveLimit) : allMatched;
    return {
        entities: results,
        ...(truncated && { totalMatched: allMatched.length }),
    };
}

export async function getEntityDetails(
    pluginId: string,
    entityId: string,
): Promise<SingleResult<DetailResult>> {
    const snapshot = await fetchPluginSnapshot(pluginId);
    if (!snapshot) return { data: null, emptyReason: "plugin_not_streaming" };

    const entity = snapshot.entities.find((e) => e.id === entityId);
    if (!entity) return { data: null, emptyReason: "no_data_matches" };

    return {
        data: {
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
        },
    };
}

export async function getPluginData(pluginId: string): Promise<SingleResult<PluginDataSnapshot>> {
    if (!pluginId.trim()) return { data: null, emptyReason: "plugin_not_streaming" };
    try {
        const snapshot = await fetchPluginSnapshot(pluginId);
        if (snapshot === null) return { data: null, emptyReason: "plugin_not_streaming" };
        if (snapshot.entities.length === 0) return { data: snapshot, emptyReason: "no_data_matches" };
        return { data: snapshot };
    } catch {
        return { data: null, emptyReason: "plugin_not_streaming" };
    }
}

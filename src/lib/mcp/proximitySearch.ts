/**
 * Proximity search behind the MCP query_entities "near" mode (v2 AX overhaul).
 *
 * Moved here from the deleted v1 proximity service, so the haversine maths and
 * the ordering guarantee live with the tool that owns them. query_entities MUST
 * keep the promise v1's find_nearby_entities made: results are sorted by true
 * great-circle distance, NEAREST FIRST, with distanceKm on every entity.
 *
 * Candidate strategy per layer:
 *   1. radiusKmToBbox(center, radius) -> a bounding box.
 *   2. getEntitiesInRegion(bbox) -> candidates (each layer capped).
 *   3. optional inline 'filters' are matched against the layer snapshot and the
 *      candidates intersected by id (a region query carries no properties, so
 *      filtering has to go back to the snapshot).
 *   4. haversine refine to <= radiusKm, nearest-first sort, cap to limit.
 *
 * v1's entity-centred form (originPluginId/originEntityId) is deliberately GONE
 * in v2: an agent reads the origin with get_entity_details, then passes
 * near.lat/near.lon. One extra call in that rare case, and it removes a second
 * overlapping finder from the surface.
 *
 * filterEntityIdsByProperty is exported because the bbox mode of query_entities
 * needs the same snapshot-intersection trick for its own 'filters' param.
 *
 * No `any`, no `@ts-ignore`.
 *
 * File: src/lib/mcp/proximitySearch.ts
 */

import { matchFilterValue } from "@/core/filters/matchFilterValue";
import type { FilterValue } from "@/core/plugins/PluginTypes";
import type { EmptyReason, SearchResult } from "@/lib/data-query/types";
import { getEntitiesInRegion, getPluginData } from "@/lib/data-query/service";
import { listStreamingPlugins, radiusKmToBbox } from "@/app/api/mcp/discoveryHelpers";

/** Mean Earth radius in kilometres used by the haversine formula. */
const EARTH_RADIUS_KM = 6371;

/** Default search radius when the caller does not specify one. */
export const DEFAULT_RADIUS_KM = 50;

/** Upper bound for radiusKm (the schema enforces it too; clamped defensively). */
export const MAX_RADIUS_KM = 1000;

/** Per-layer candidate cap passed to the bbox region query. */
const REGION_CANDIDATE_CAP = 200;

/**
 * Great-circle distance between two WGS84 coordinates in kilometres
 * (haversine formula, Earth radius 6371 km).
 */
export function haversineDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
): number {
    const toRad = (deg: number): number => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    // Clamp to [0, 1] so floating-point overshoot can never produce NaN.
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(a, 1)));
}

/** A spatial result annotated with its distance from the search center. */
export interface NearbyEntity extends SearchResult {
    distanceKm: number;
}

export interface FindNearbyOptions {
    /** Center latitude [-90, 90]. */
    lat: number;
    /** Center longitude [-180, 180]. */
    lon: number;
    /** Search radius in kilometres (default 50, max 1000). */
    radiusKm?: number;
    /** Layers to search; when omitted, every streaming layer is searched. */
    pluginIds?: string[];
    /** Maximum entities to return, nearest first. */
    limit?: number;
    /** Optional inline property filters applied to candidates. */
    filters?: Record<string, FilterValue>;
}

/** Outcome of a proximity search, in the envelope's vocabulary. */
export interface NearSearchResult {
    /** Sorted by distanceKm ascending -- nearest first. */
    entities: NearbyEntity[];
    center: { latitude: number; longitude: number };
    /** The radius actually applied after clamping. */
    radiusKm: number;
    /** Present only when the list was capped: the number found before the cap. */
    totalMatched?: number;
    /** Present only when entities is empty AND a defensible service reason exists. */
    emptyReason?: EmptyReason;
    /**
     * True when no plugin list could be read because the data engine itself is
     * unreachable. An OUTAGE, which the tool must report as a failure and never
     * as an empty result.
     */
    engineUnreachable?: boolean;
}

/**
 * Ids of a layer's entities whose properties match ALL provided filters.
 * Returns null when the layer snapshot is unavailable -- callers treat that as
 * "no candidates" rather than an all-match fallback, so a filter can never
 * silently widen a result set.
 */
export async function filterEntityIdsByProperty(
    pluginId: string,
    filters: Record<string, FilterValue>,
): Promise<Set<string> | null> {
    const snapshot = await getPluginData(pluginId);
    if (snapshot.data === null) return null;

    const entries = Object.entries(filters);
    const ids = new Set<string>();
    for (const entity of snapshot.data.entities) {
        if (entries.every(([key, filter]) => matchFilterValue(entity.properties[key], filter))) {
            ids.add(entity.id);
        }
    }
    return ids;
}

/** Nearest-first proximity search around a center point. */
export async function findNearbyEntities(opts: FindNearbyOptions): Promise<NearSearchResult> {
    const radiusKm = Math.min(Math.max(opts.radiusKm ?? DEFAULT_RADIUS_KM, 0.001), MAX_RADIUS_KM);
    const limit = Math.max(1, opts.limit ?? 20);

    let pluginIds: string[];
    let engineUnreachable = false;
    if (opts.pluginIds !== undefined && opts.pluginIds.length > 0) {
        pluginIds = Array.from(new Set(opts.pluginIds));
    } else {
        const plugins = await listStreamingPlugins();
        pluginIds = plugins.plugins.map((p) => p.pluginId);
        engineUnreachable = plugins.reason === "engine_unreachable";
    }

    const bbox = radiusKmToBbox(opts.lat, opts.lon, radiusKm);
    const found: NearbyEntity[] = [];
    let offlineLayers = 0;
    let noMatchLayers = 0;

    for (const pluginId of pluginIds) {
        const region = await getEntitiesInRegion({
            ...bbox,
            pluginId,
            limit: REGION_CANDIDATE_CAP,
        });
        if (region.emptyReason === "plugin_not_streaming") {
            offlineLayers += 1;
            continue;
        }
        if (region.emptyReason === "no_data_matches") noMatchLayers += 1;

        let candidates = region.entities;
        const filters = opts.filters;
        if (filters !== undefined && Object.keys(filters).length > 0) {
            const allowed = await filterEntityIdsByProperty(pluginId, filters);
            if (allowed === null) continue; // snapshot unavailable -> no candidates
            candidates = candidates.filter((candidate) => allowed.has(candidate.id));
        }

        for (const candidate of candidates) {
            const distanceKm = haversineDistanceKm(
                opts.lat,
                opts.lon,
                candidate.latitude,
                candidate.longitude,
            );
            if (distanceKm > radiusKm) continue;
            found.push({ ...candidate, distanceKm });
        }
    }

    found.sort((a, b) => a.distanceKm - b.distanceKm);
    const truncated = found.length > limit;
    const entities = truncated ? found.slice(0, limit) : found;

    return {
        center: { latitude: opts.lat, longitude: opts.lon },
        radiusKm,
        entities,
        ...(truncated && { totalMatched: found.length }),
        ...(engineUnreachable && { engineUnreachable: true }),
        ...(entities.length === 0 && !engineUnreachable && {
            emptyReason: emptyReasonForLayers(pluginIds.length, offlineLayers, noMatchLayers),
        }),
    };
}

/**
 * Reason for an empty proximity result. Only ever returns a reason the sources
 * actually support: nothing reported -> undefined -> "unknown" at the envelope,
 * never "no_data_matches".
 */
function emptyReasonForLayers(
    layerCount: number,
    offlineLayers: number,
    noMatchLayers: number,
): EmptyReason | undefined {
    if (noMatchLayers > 0) return "no_data_matches";
    if (layerCount === 0 || offlineLayers > 0) return "plugin_not_streaming";
    return undefined;
}

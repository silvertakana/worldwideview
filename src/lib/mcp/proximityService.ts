/**
 * Proximity search service for the MCP find_nearby_entities tool (PR 1).
 *
 * Provides:
 *   haversineDistanceKm -- great-circle distance between two coordinates
 *   findNearbyEntities  -- server-side proximity search (point-to-entities
 *                          and entity-to-entities) with true Haversine
 *                          distance sorting and per-entity distanceKm
 *                          annotations.
 *
 * Candidate gathering per plugin:
 *   1. Resolve the center (lat/lon or the origin entity via getEntityDetails).
 *   2. Compute a bounding box with radiusKmToBbox and query candidate
 *      entities via getEntitiesInRegion (per-plugin, capped at 200).
 *   3. Optional inline filters are matched against the plugin snapshot
 *      properties (RegionOptions carries no filter field), then candidates
 *      are intersected by id.
 *   4. Refine each candidate with haversine distance <= radiusKm, exclude the
 *      origin entity itself for entity-based queries, sort nearest-first,
 *      and truncate to limit.
 *
 * No `any`, no `@ts-ignore`. All external I/O is delegated to the data-query
 * service and discovery helper imports below.
 */

import type { FilterValue } from "@/core/plugins/PluginTypes";
import { matchFilterValue } from "@/core/filters/matchFilterValue";
import type { SearchResult } from "@/lib/data-query/types";
import {
    getEntitiesInRegion,
    getEntityDetails,
    getPluginData,
} from "@/lib/data-query/service";
import {
    listStreamingPlugins,
    radiusKmToBbox,
} from "@/app/api/mcp/discoveryHelpers";

/** Mean Earth radius in kilometres used by the haversine formula. */
const EARTH_RADIUS_KM = 6371;

/** Default search radius when the caller does not specify one. */
const DEFAULT_RADIUS_KM = 50;

/** Upper bound for radiusKm (schema enforces it too; clamped defensively). */
const MAX_RADIUS_KM = 1000;

/** Default result cap when the caller does not specify a limit. */
const DEFAULT_LIMIT = 20;

/** Upper bound for the returned entity count. */
const MAX_LIMIT = 100;

/** Per-plugin candidate cap passed to the bbox region query. */
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

/** A region candidate annotated with its distance from the search center. */
export interface NearbyEntity extends SearchResult {
    distanceKm: number;
}

export interface FindNearbyOptions {
    /** Center latitude [-90, 90] -- alternative to originPluginId/originEntityId. */
    lat?: number;
    /** Center longitude [-180, 180] -- alternative to originPluginId/originEntityId. */
    lon?: number;
    /** Plugin ID of the origin entity to center the search around. */
    originPluginId?: string;
    /** Entity ID of the origin entity to center the search around. */
    originEntityId?: string;
    /** Search radius in kilometres (default 50, max 1000). */
    radiusKm?: number;
    /** Optional plugin IDs to search within; when omitted, all active plugins. */
    targetPluginIds?: string[];
    /** Maximum entities to return (default 20, max 100, nearest first). */
    limit?: number;
    /** Optional inline property filters applied to candidate entities. */
    filters?: Record<string, FilterValue>;
}

export type FindNearbySuccess = {
    success: true;
    center: {
        latitude: number;
        longitude: number;
        originPluginId?: string;
        originEntityId?: string;
        originLabel?: string;
    };
    radiusKm: number;
    count: number;
    entities: NearbyEntity[];
};

export type FindNearbyResult =
    | FindNearbySuccess
    | { success: false; entities: []; count: 0; emptyReason: "origin_entity_not_found" }
    | { success: false; entities: []; count: 0; error: string };

/**
 * Returns the ids of a plugin's entities whose properties match ALL provided
 * filters. Returns null when the plugin snapshot is unavailable -- callers
 * treat that as "no candidates" rather than an all-match fallback (matches
 * the conservative empty semantics of the other data-query tools).
 */
async function filterMatchingEntityIds(
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

/**
 * Server-side proximity search: nearest-first entities around a center point
 * (coordinates or an origin entity), sorted by true haversine distance with
 * per-entity distanceKm.
 */
export async function findNearbyEntities(opts: FindNearbyOptions): Promise<FindNearbyResult> {
    // ------------------------------------------------------------------
    // Resolve the search center (coordinates or origin entity).
    // ------------------------------------------------------------------
    const hasOrigin = opts.originPluginId !== undefined || opts.originEntityId !== undefined;
    if (hasOrigin) {
        if (opts.originPluginId === undefined || opts.originEntityId === undefined) {
            return {
                success: false,
                entities: [],
                count: 0,
                error: "originPluginId and originEntityId must be provided together",
            };
        }
    } else if (opts.lat === undefined || opts.lon === undefined) {
        return {
            success: false,
            entities: [],
            count: 0,
            error: "A center is required: provide lat + lon or originPluginId + originEntityId",
        };
    }

    let centerLat: number;
    let centerLon: number;
    let originLabel: string | undefined;

    if (opts.originPluginId !== undefined && opts.originEntityId !== undefined) {
        const detail = await getEntityDetails(opts.originPluginId, opts.originEntityId);
        if (detail.data === null) {
            return { success: false, entities: [], count: 0, emptyReason: "origin_entity_not_found" };
        }
        centerLat = detail.data.latitude;
        centerLon = detail.data.longitude;
        originLabel = detail.data.label;
    } else {
        centerLat = opts.lat as number;
        centerLon = opts.lon as number;
    }

    const radiusKm = Math.min(Math.max(opts.radiusKm ?? DEFAULT_RADIUS_KM, 0.001), MAX_RADIUS_KM);
    const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

    // ------------------------------------------------------------------
    // Resolve the target plugin set.
    // ------------------------------------------------------------------
    let pluginIds: string[];
    if (opts.targetPluginIds !== undefined && opts.targetPluginIds.length > 0) {
        pluginIds = Array.from(new Set(opts.targetPluginIds));
    } else {
        const plugins = await listStreamingPlugins();
        pluginIds = plugins.plugins.map((p) => p.pluginId);
    }

    const bbox = radiusKmToBbox(centerLat, centerLon, radiusKm);
    const isEntityCentered = opts.originEntityId !== undefined && opts.originPluginId !== undefined;

    // ------------------------------------------------------------------
    // Gather + refine candidates per plugin.
    // ------------------------------------------------------------------
    const found: NearbyEntity[] = [];
    for (const pluginId of pluginIds) {
        const region = await getEntitiesInRegion({
            ...bbox,
            pluginId,
            limit: REGION_CANDIDATE_CAP,
        });

        let candidates = region.entities;
        const filters = opts.filters;
        if (filters !== undefined && Object.keys(filters).length > 0) {
            const allowed = await filterMatchingEntityIds(pluginId, filters);
            if (allowed === null) continue; // snapshot unavailable -> no candidates
            candidates = candidates.filter((c) => allowed.has(c.id));
        }

        for (const candidate of candidates) {
            if (
                isEntityCentered &&
                candidate.pluginId === opts.originPluginId &&
                candidate.id === opts.originEntityId
            ) {
                continue; // never report the origin entity against itself
            }
            const distanceKm = haversineDistanceKm(
                centerLat,
                centerLon,
                candidate.latitude,
                candidate.longitude,
            );
            if (distanceKm > radiusKm) continue;
            found.push({ ...candidate, distanceKm });
        }
    }

    found.sort((a, b) => a.distanceKm - b.distanceKm);
    const entities = found.slice(0, limit);

    return {
        success: true,
        center: {
            latitude: centerLat,
            longitude: centerLon,
            ...(isEntityCentered
                ? {
                      originPluginId: opts.originPluginId as string,
                      originEntityId: opts.originEntityId as string,
                      ...(originLabel !== undefined && { originLabel }),
                  }
                : {}),
        },
        radiusKm,
        count: entities.length,
        entities,
    };
}
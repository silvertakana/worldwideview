/**
 * query_entities routing: bbox | near | query, multi-layer, projected.
 *
 * Split out of tools.ts (which owns registration and the id-addressed tools) to
 * stay inside the repo's ~300-line file limit, and to keep the routing testable
 * without standing up an McpServer.
 *
 * v2 collapsed three overlapping v1 finders -- search_entities,
 * get_entities_in_region and find_nearby_entities -- into this one entry point,
 * so there is exactly one answer to "find entities".
 *
 * File: src/lib/mcp/entityQuery.ts
 */

import type { FilterValue } from "@/core/plugins/PluginTypes";
import { getEntitiesInRegion, searchEntities } from "@/lib/data-query/service";
import type { EmptyReason, QueryResult, SearchResult } from "@/lib/data-query/types";
import {
    clampLimit,
    normalizePluginIds,
    respondEntities,
    MAX_LIMIT,
} from "@/lib/mcp/entityResponse";
import { filterEntityIdsByProperty, findNearbyEntities } from "@/lib/mcp/proximitySearch";
import { mcpFail, type McpTextResult } from "@/lib/mcp/responseEnvelope";

/** Default cap when the caller passes no limit. */
const DEFAULT_LIMIT = 50;
/** The data-query service caps a text search at 100 entities per layer and reports no truncation flag. */
const TEXT_SEARCH_CAP = 100;

/** What the tool schema validates down to: the shape this module routes. */
export interface QueryEntitiesInput {
    bbox?: { north: number; south: number; east: number; west: number };
    near?: { lat: number; lon: number; radiusKm?: number };
    query?: string;
    pluginIds?: string[];
    filters?: Record<string, FilterValue>;
    fields?: string[];
    limit?: number;
}

/** Case-insensitive full-text match on an entity's name (mirrors the service's rule). */
function matchesQuery(entity: SearchResult, query: string): boolean {
    const needle = query.trim().toLowerCase();
    return (entity.name ?? entity.id).toLowerCase().includes(needle);
}

interface CollectedEntities {
    entities: SearchResult[];
    /** Present only when entities is empty AND a source stated a reason. */
    emptyReason?: EmptyReason;
    /** Present only when a source cut its list short. */
    totalMatched?: number;
}

/**
 * Runs a list query across the requested layers.
 *
 * With no pluginIds the service sweeps every streaming layer in one call and its
 * own answer passes through untouched. With an explicit list, one call runs per
 * layer and the answers merge; the merged empty reason is only reported when a
 * source actually stated one, so an unstated reason stays undefined and resolves
 * to "unknown" at the envelope.
 */
async function collectEntities(
    pluginIds: string[] | undefined,
    runOne: (pluginId: string | undefined) => Promise<QueryResult<SearchResult>>,
    cap: number,
): Promise<CollectedEntities> {
    if (pluginIds === undefined) {
        const result = await runOne(undefined);
        return {
            entities: result.entities,
            ...(result.emptyReason !== undefined && { emptyReason: result.emptyReason }),
            ...(result.totalMatched !== undefined && { totalMatched: result.totalMatched }),
        };
    }

    const entities: SearchResult[] = [];
    let offlineLayers = 0;
    let noMatchLayers = 0;
    let sourceTotal = 0;
    let sourceTruncated = false;

    for (const pluginId of pluginIds) {
        const result = await runOne(pluginId);
        if (result.emptyReason === "plugin_not_streaming") offlineLayers += 1;
        else if (result.emptyReason === "no_data_matches") noMatchLayers += 1;
        sourceTotal += result.totalMatched ?? result.entities.length;
        if (result.totalMatched !== undefined) sourceTruncated = true;
        for (const entity of result.entities) {
            if (entities.length >= cap) break;
            entities.push(entity);
        }
    }

    return {
        entities,
        ...(entities.length === 0 && {
            emptyReason: mergedEmptyReason(offlineLayers, noMatchLayers),
        }),
        ...(sourceTruncated && { totalMatched: sourceTotal }),
    };
}

/**
 * Merged empty reason for a multi-layer sweep: only ever a reason a source
 * stated. Offline layers are named only when no live layer answered at all.
 */
function mergedEmptyReason(
    offlineLayers: number,
    noMatchLayers: number,
): EmptyReason | undefined {
    if (noMatchLayers > 0) return "no_data_matches";
    if (offlineLayers > 0) return "plugin_not_streaming";
    return undefined;
}

/**
 * Applies inline property filters to region results by intersecting them with
 * the matching ids of each layer snapshot (a region query carries no
 * properties). A layer whose snapshot cannot be read contributes no candidates,
 * so a filter can never silently widen a result set.
 */
async function applyInlineFilters(
    entities: SearchResult[],
    filters: Record<string, FilterValue>,
): Promise<SearchResult[]> {
    const byPlugin = new Map<string, SearchResult[]>();
    for (const entity of entities) {
        const bucket = byPlugin.get(entity.pluginId);
        if (bucket === undefined) byPlugin.set(entity.pluginId, [entity]);
        else bucket.push(entity);
    }

    const matched: SearchResult[] = [];
    for (const [pluginId, bucket] of byPlugin) {
        const allowed = await filterEntityIdsByProperty(pluginId, filters);
        if (allowed === null) continue;
        for (const entity of bucket) {
            if (allowed.has(entity.id)) matched.push(entity);
        }
    }
    return matched;
}

/** near mode: haversine proximity, nearest-first (the v2 home of find_nearby_entities). */
async function runNearMode(
    near: { lat: number; lon: number; radiusKm?: number },
    query: string,
    pluginIds: string[] | undefined,
    limit: number,
    filters: Record<string, FilterValue> | undefined,
    fields: string[] | undefined,
): Promise<McpTextResult> {
    const intersected = query !== "";
    // Same rule as bbox mode: when a name query will cut the set down, gather at
    // the hard cap and apply the caller's limit afterwards, so a match beyond the
    // nearest N is still findable.
    const searchLimit = intersected ? MAX_LIMIT : limit;

    const result = await findNearbyEntities({
        lat: near.lat,
        lon: near.lon,
        ...(near.radiusKm !== undefined && { radiusKm: near.radiusKm }),
        ...(pluginIds !== undefined && { pluginIds }),
        limit: searchLimit,
        ...(filters !== undefined && { filters }),
    });

    if (result.engineUnreachable === true) {
        return mcpFail(
            "engine_unreachable",
            "The data engine is unreachable, so the proximity search could not run.",
            {
                hint: "This is an OUTAGE, not an empty result -- do not report 'no data found'. Retry shortly, or tell the user the data source is down.",
            },
        );
    }

    const matched = intersected
        ? result.entities.filter((entity) => matchesQuery(entity, query))
        : result.entities;

    const cappedHere = matched.length > limit;
    const entities = cappedHere ? matched.slice(0, limit) : matched;

    return respondEntities(
        {
            entities,
            order: "distance",
            ...(result.emptyReason !== undefined && { emptyReason: result.emptyReason }),
            ...(result.totalMatched !== undefined &&
                !intersected &&
                !cappedHere && { totalMatched: result.totalMatched }),
            ...(result.entities.length > 0 && entities.length === 0 && { liveButFilteredOut: true }),
        },
        fields,
    );
}

/** bbox mode: rectangular region query, optionally intersected with a name query. */
async function runBboxMode(
    bbox: { north: number; south: number; east: number; west: number },
    query: string,
    pluginIds: string[] | undefined,
    limit: number,
    filters: Record<string, FilterValue> | undefined,
    fields: string[] | undefined,
): Promise<McpTextResult> {
    const intersected = query !== "";
    const filtered = filters !== undefined && Object.keys(filters).length > 0;
    // Gather at the hard cap when the set will be cut down afterwards, so the
    // caller's limit lands on entities that actually match the query.
    const gatherLimit = intersected ? MAX_LIMIT : limit;

    const collected = await collectEntities(
        pluginIds,
        (pluginId) =>
            getEntitiesInRegion({
                ...bbox,
                ...(pluginId !== undefined && { pluginId }),
                limit: gatherLimit,
            }),
        gatherLimit,
    );

    let entities = filtered ? await applyInlineFilters(collected.entities, filters) : collected.entities;
    if (intersected) entities = entities.filter((entity) => matchesQuery(entity, query));

    const cappedHere = entities.length > limit;
    const finalEntities = cappedHere ? entities.slice(0, limit) : entities;
    const cleanTotal = !intersected && !filtered && !cappedHere;

    return respondEntities(
        {
            entities: finalEntities,
            order: "unspecified",
            ...(collected.entities.length === 0 &&
                collected.emptyReason !== undefined && { emptyReason: collected.emptyReason }),
            ...(cleanTotal &&
                collected.totalMatched !== undefined && { totalMatched: collected.totalMatched }),
            ...(collected.entities.length > 0 &&
                finalEntities.length === 0 && { liveButFilteredOut: true }),
        },
        fields,
    );
}

/** query-only mode: full-text search across the requested layers. */
async function runTextMode(
    query: string,
    pluginIds: string[] | undefined,
    limit: number,
    filters: Record<string, FilterValue> | undefined,
    fields: string[] | undefined,
): Promise<McpTextResult> {
    const cap = Math.min(limit, TEXT_SEARCH_CAP);
    const collected = await collectEntities(
        pluginIds,
        (pluginId) => searchEntities(query, pluginId, cap, filters),
        cap,
    );

    return respondEntities(
        {
            entities: collected.entities,
            order: "unspecified",
            ...(collected.emptyReason !== undefined && { emptyReason: collected.emptyReason }),
            ...(collected.totalMatched !== undefined && { totalMatched: collected.totalMatched }),
        },
        fields,
    );
}

/** Routes one query_entities call to its mode. Returns a v2 envelope on every path. */
export async function runQueryEntities(input: QueryEntitiesInput): Promise<McpTextResult> {
    const bbox = input.bbox;
    const near = input.near;
    const query = input.query?.trim() ?? "";

    if (bbox === undefined && near === undefined && query === "") {
        return mcpFail("invalid_parameters", "query_entities needs at least one search mode.", {
            hint:
                "Pass bbox { north, south, east, west } for a rectangular area, near { lat, lon, radiusKm } for a proximity search (nearest first), or query for a full-text match on entity name. bbox+query and near+query are allowed and intersect.",
            validValues: ["bbox", "near", "query"],
        });
    }

    const limit = clampLimit(input.limit, DEFAULT_LIMIT);
    const pluginIds = normalizePluginIds(input.pluginIds);

    if (near !== undefined) {
        return await runNearMode(near, query, pluginIds, limit, input.filters, input.fields);
    }
    if (bbox !== undefined) {
        return await runBboxMode(bbox, query, pluginIds, limit, input.filters, input.fields);
    }
    return await runTextMode(query, pluginIds, limit, input.filters, input.fields);
}

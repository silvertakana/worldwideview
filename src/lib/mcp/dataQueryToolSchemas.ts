/**
 * Tool definitions (description + inputSchema) for the data-query registrar.
 *
 * Split out of tools.ts to keep that file inside the repo's ~300-line limit.
 * tools.ts imports these and owns only routing and the response envelope.
 *
 * The descriptions carry the routing doctrine the v1 surface lacked: each one
 * names its siblings and says when to prefer them, states the empty-result
 * meanings, and ends with a concrete Example: call.
 *
 * File: src/lib/mcp/dataQueryToolSchemas.ts
 */

import { z } from "zod";
import { latSchema, lonSchema } from "@/lib/mcp/coordinateSchemas";
import { filterValueSchema } from "@/lib/mcp/filterSchemas";

/** query_entities: the single find-entities entry point (bbox | near | query). */
export const QUERY_ENTITIES_TOOL = {
    description:
        "THE find-entities tool: use this for every 'find / where is / what is near / what is in' question across all streaming layers. It replaces the v1 search_entities, get_entities_in_region and find_nearby_entities tools. " +
        "Give it at least one of three modes: bbox { north, south, east, west } for a rectangular area, near { lat, lon, radiusKm } for a proximity search, or query for a full-text match on entity name/label. " +
        "Modes combine: bbox+query and near+query return only entities inside the area whose name also matches the query. " +
        "A near search is sorted NEAREST FIRST and annotates every entity with distanceKm; meta.order tells you which ordering you got ('distance' for near, 'unspecified' otherwise). " +
        "pluginIds sweeps several layers in one call (e.g. ['flights','maritime']); omit it to search every streaming layer. 'filters' applies inline property filters. " +
        "'fields' projects each entity down to just those keys to keep the payload small; a field name that does not exist is reported in meta.unknownFields, never as an error. " +
        "Read meta before you answer: 'truncated' means the list is a capped sample (meta.totalMatched is the full count). " +
        "On an empty result read meta.emptyReason: 'plugin_not_streaming' means the layer is NOT streaming, so nothing was searchable -- check tools/list or call orient for the live layers, and never report it as 'no data found'; 'no_data_matches' means the layer is live and genuinely had no match; 'unknown' means the source did not say why. " +
        "Example: query_entities({ bbox: { north: 52, south: 51, east: 0, west: -1 }, query: 'flight', pluginIds: ['flights'], fields: ['id','name','latitude','longitude'], limit: 50 }) " +
        "Example: query_entities({ near: { lat: 51.5074, lon: -0.1278, radiusKm: 100 }, limit: 10 })",
    inputSchema: {
        bbox: z
            .object({
                north: latSchema.describe("Northern latitude bound"),
                south: latSchema.describe("Southern latitude bound"),
                east: lonSchema.describe("Eastern longitude bound"),
                west: lonSchema.describe("Western longitude bound"),
            })
            .optional()
            .describe("Bounding-box mode: entities inside this rectangle. An east bound below the west bound means a box crossing the antimeridian."),
        near: z
            .object({
                lat: latSchema.describe("Center latitude"),
                lon: lonSchema.describe("Center longitude"),
                radiusKm: z
                    .number()
                    .positive()
                    .max(1000)
                    .optional()
                    .describe("Search radius in kilometres (default 50, max 1000)"),
            })
            .optional()
            .describe("Proximity mode: entities within radiusKm of the center, sorted nearest-first with distanceKm on each result."),
        query: z
            .string()
            .optional()
            .describe("Full-text match on entity name/label. On its own it searches every streaming layer; combined with bbox or near it filters that spatial result."),
        pluginIds: z
            .array(z.string())
            .optional()
            .describe("Layer ids to search, e.g. ['flights','maritime']. Omit to search every streaming layer. An unknown id yields no entities from that layer."),
        filters: z
            .record(z.string(), filterValueSchema)
            .optional()
            .describe("Inline property filters keyed by entity property name, e.g. { status: { type: 'select', values: ['airborne'] } }. Independent of set_filter state."),
        fields: z
            .array(z.string())
            .optional()
            .describe("Project each entity to these keys only, e.g. ['id','name','latitude','longitude']. Omit for the full record. Unknown names come back in meta.unknownFields."),
        limit: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Maximum entities returned (default 50, clamped to 200). A query-only search is further capped at 100 per layer by the data source."),
    },
};

/** get_entity_details: one entity by id, after query_entities found it. */
export const GET_ENTITY_DETAILS_TOOL = {
    description:
        "Full detail for ONE entity, by pluginId + entityId. Use it AFTER query_entities, when you already hold an id and want the complete record (properties included). " +
        "It cannot search: it does not match names, areas or filters -- for that use query_entities. For a whole layer's live state use get_plugin_data. " +
        "'fields' projects the record down to just those keys; a name that does not exist is reported in meta.unknownFields, never as an error. " +
        "On an empty result meta.emptyReason tells you which case you hit: 'plugin_not_streaming' means the layer is not streaming, so the entity is not necessarily missing (check tools/list or call orient); 'no_data_matches' means the layer is live and has no such id. " +
        "If pluginId is not a known layer at all, the call fails with error 'unknown_plugin' and the valid layer ids in validValues -- retry with one of those instead of guessing again. " +
        "Example: get_entity_details({ pluginId: 'flights', entityId: 'BA123', fields: ['id','label','altitude','speed'] })",
    inputSchema: {
        pluginId: z.string().describe("The layer that owns this entity (required)"),
        entityId: z.string().describe("The entity id, exactly as returned by query_entities (required)"),
        fields: z
            .array(z.string())
            .optional()
            .describe("Project the record to these keys only, e.g. ['id','label','altitude']. Unknown names come back in meta.unknownFields."),
    },
};

/** get_plugin_data: a whole layer's live snapshot. */
export const GET_PLUGIN_DATA_TOOL = {
    description:
        "Whole live snapshot for ONE layer: every entity it is currently streaming, capped at 200. Use it when you want a layer's full state, its size, or its shape. " +
        "Prefer query_entities whenever you only need entities matching an area, a name, or filters -- this tool returns everything and is the most token-expensive query in the server. " +
        "'fields' projects each entity down to just those keys (unknown names come back in meta.unknownFields, never as an error); meta.capturedAt is when the snapshot was taken. " +
        "meta.truncated plus meta.totalMatched tell you whether you are seeing all of it. " +
        "On an empty result meta.emptyReason tells you which case you hit: 'plugin_not_streaming' means the layer is offline or was never loaded (check tools/list or call orient for the live layers, and never report it as 'no data found'); 'no_data_matches' means it is loaded but has streamed nothing yet. " +
        "An unknown pluginId fails with error 'unknown_plugin' and the valid layer ids in validValues. " +
        "Example: get_plugin_data({ pluginId: 'earthquakes', fields: ['id','label','latitude','longitude'], limit: 200 })",
    inputSchema: {
        pluginId: z.string().describe("The layer id (required)"),
        fields: z
            .array(z.string())
            .optional()
            .describe("Project each entity to these keys only, e.g. ['id','latitude','longitude']. Unknown names come back in meta.unknownFields."),
        limit: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Maximum entities returned (default 200, clamped to 200)"),
    },
};

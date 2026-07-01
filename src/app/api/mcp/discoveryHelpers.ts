/**
 * Discovery helpers shared by discoveryTools.ts (Phase 29 -- 29-01).
 *
 * Provides:
 *   radiusKmToBbox    -- geographic bounding box from a center + radius
 *   deriveEntityTypes -- queryable property/filter-key names for a plugin snapshot
 *   listStreamingPlugins -- manifest + per-plugin counts for list_available_plugins
 *   buildInvestigateProse -- deterministic prose for investigate_area result summaries
 *   composeGlobeContext  -- full context payload for get_globe_context
 *
 * No `any`, no `@ts-ignore`. All external I/O is delegated to the service/store
 * helpers imported below.
 */

import type { PluginDataSnapshot } from "@/lib/data-query/types";
import type { RegionOptions } from "@/lib/data-query/types";
import type { FilterDefinition } from "@/core/plugins/PluginTypes";
import { getEngineUrl, getAllPluginSnapshots } from "@/lib/data-query/service";
import { getLocalSourceIds } from "@/lib/data-query/localSources";
import { readActiveSessions, readGlobeState } from "@/lib/globeStateStore";
import { readSessionCatalog } from "@/lib/mcpSessionCatalog";
import { resolveActiveSessionId } from "@/lib/globeCommandQueue";

// ---------------------------------------------------------------------------
// Bbox math
// ---------------------------------------------------------------------------

/** Maximum number of entity property keys to sample when deriving entity types. */
const MAX_PROPERTY_SAMPLE = 50;

/**
 * Converts a center coordinate + radius into a RegionOptions bounding box.
 *
 * Latitude delta: radiusKm / 111 (1 degree lat ~ 111 km).
 * Longitude delta: radiusKm / (111 * cos(lat)), clamped to avoid divide-by-zero
 * near the poles (cos(lat) < 0.01 treated as 0.01). East/west are wrapped to
 * [-180, 180] so points near the antimeridian produce in-range bounds (the
 * region query handles east < west as an antimeridian-crossing box).
 */
export function radiusKmToBbox(lat: number, lon: number, radiusKm: number): RegionOptions {
    const latDelta = radiusKm / 111;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const clampedCos = Math.max(cosLat, 0.01);
    // Cap lonDelta at 180 so a globe-spanning radius yields the full longitude
    // range [-180, 180] rather than wrapping to a thin antimeridian strip.
    const lonDelta = Math.min(radiusKm / (111 * clampedCos), 180);
    const wrapLon = (v: number): number => ((((v + 180) % 360) + 360) % 360) - 180;
    return {
        north: Math.min(lat + latDelta, 90),
        south: Math.max(lat - latDelta, -90),
        east: wrapLon(lon + lonDelta),
        west: wrapLon(lon - lonDelta),
    };
}

// ---------------------------------------------------------------------------
// Entity type derivation
// ---------------------------------------------------------------------------

/**
 * Returns the queryable field identifiers for a plugin snapshot.
 *
 * When the browser has published filterDefinitions for the plugin (via the
 * session catalog), return those field ids -- they are authoritative.
 * Otherwise, sample distinct `properties` keys from the snapshot entities as a
 * best-effort fallback.
 */
export function deriveEntityTypes(
    snapshot: PluginDataSnapshot,
    filterDefs?: FilterDefinition[],
): string[] {
    if (filterDefs && filterDefs.length > 0) {
        return filterDefs.map((d) => d.id);
    }

    const keys = new Set<string>();
    const sample = snapshot.entities.slice(0, MAX_PROPERTY_SAMPLE);
    for (const entity of sample) {
        for (const key of Object.keys(entity.properties ?? {})) {
            keys.add(key);
        }
    }
    return Array.from(keys);
}

// ---------------------------------------------------------------------------
// Plugin listing
// ---------------------------------------------------------------------------

export interface StreamingPlugin {
    pluginId: string;
    /** Engine manifest exposes ids only; pluginName equals pluginId until the
     * manifest or a richer source provides display names. */
    pluginName: string;
    entityCount: number;
    entityTypes: string[];
    /** Whether this plugin's data originates from the live engine stream or a
     * server-reachable local/static source (D-05). */
    source: "engine" | "local";
}

export interface ListStreamingPluginsResult {
    plugins: StreamingPlugin[];
    reason?: string;
}

/**
 * Probes whether the data engine manifest endpoint is reachable.
 * Returns true when the engine responds with 2xx, false on network error or non-2xx.
 *
 * Timeout is intentionally short (2000ms) so callers on the empty-snapshot path
 * are not blocked waiting for a slow engine.
 */
async function probeEngineReachable(): Promise<boolean> {
    const engineUrl = getEngineUrl() + "/manifest";
    try {
        const res = await fetch(engineUrl, { signal: AbortSignal.timeout(2000) });
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * Fetches the engine manifest and per-plugin snapshots to build a summary list.
 *
 * Reasons when plugins array is empty:
 *   engine_unreachable  -- manifest fetch failed or engine returned non-2xx.
 *   no_active_plugins   -- engine reachable but zero plugins active right now.
 *
 * Local sources (e.g. camera) are tagged source:'local' and are surfaced
 * even when the engine is down (getAllPluginSnapshots includes local sources).
 *
 * The probe runs only on the empty-snapshot path to avoid the double-manifest
 * hit on every happy-path call.
 */
export async function listStreamingPlugins(): Promise<ListStreamingPluginsResult> {
    const [snapshots, localIds] = await Promise.all([
        getAllPluginSnapshots(),
        getLocalSourceIds(),
    ]);

    if (snapshots.length === 0) {
        const engineReachable = await probeEngineReachable();
        const reason = engineReachable ? "no_active_plugins" : "engine_unreachable";
        return { plugins: [], reason };
    }

    const plugins: StreamingPlugin[] = snapshots.map((snap) => ({
        pluginId: snap.pluginId,
        pluginName: snap.pluginId, // manifest exposes ids only
        entityCount: snap.entities.length,
        entityTypes: deriveEntityTypes(snap),
        source: localIds.has(snap.pluginId) ? "local" : "engine",
    }));
    return { plugins };
}

// ---------------------------------------------------------------------------
// Prose builder
// ---------------------------------------------------------------------------

export interface InvestigateProseArgs {
    displayName: string;
    entityType: string;
    matchedPlugin: string | null;
    entityCount: number;
    sessionPresent: boolean;
    emptyReason?: string;
}

/**
 * Builds deterministic (non-LLM) prose for the investigate_area summary field.
 * Covers four cases:
 *   - Happy: entities found
 *   - No matching plugin: entity_type does not match any streaming plugin
 *   - No data matches: plugin streams but no entities in the region
 *   - No session: data queried but camera pan skipped
 */
export function buildInvestigateProse(args: InvestigateProseArgs): string {
    const { displayName, entityType, matchedPlugin, entityCount, sessionPresent, emptyReason } = args;

    if (matchedPlugin === null) {
        return (
            `No active plugin streams "${entityType}". ` +
            `Use list_available_plugins to see which entity types are currently streaming, ` +
            `then retry investigate_area with a matching entity_type.`
        );
    }

    if (entityCount > 0) {
        const cameraNote = sessionPresent
            ? "Camera has been panned to the area."
            : "No active globe session -- camera pan skipped.";
        return (
            `Found ${entityCount} ${entityType} ${entityCount === 1 ? "entity" : "entities"} ` +
            `near ${displayName} (plugin: ${matchedPlugin}). ${cameraNote}`
        );
    }

    // Empty result -- explain why.
    if (emptyReason === "plugin_not_streaming") {
        return (
            `Plugin "${matchedPlugin}" matched your entity_type "${entityType}" but is not ` +
            `currently streaming data. The engine may be loading or the plugin may be offline.`
        );
    }

    const cameraNote = sessionPresent
        ? "Camera was panned to the area."
        : "No active globe session -- camera pan skipped.";
    return (
        `No ${entityType} entities found near ${displayName} (plugin: ${matchedPlugin}). ` +
        `The plugin is streaming but returned no data for this region and radius. ` +
        cameraNote
    );
}

// ---------------------------------------------------------------------------
// Globe context composer
// ---------------------------------------------------------------------------

export interface GlobeContextPayload {
    sessionCount: number;
    camera: Record<string, number> | null;
    layers: Record<string, unknown>;
    filters: {
        note: string;
        definitions?: Record<string, unknown[]>;
    };
    plugins: StreamingPlugin[];
    reason?: string;
}

/**
 * Composes a full globe context snapshot for get_globe_context.
 * Never throws -- all sub-calls are best-effort; missing data falls back to nulls/empty.
 */
export async function composeGlobeContext(userId: string): Promise<GlobeContextPayload> {
    const [sessions, pluginsResult] = await Promise.all([
        readActiveSessions(userId),
        listStreamingPlugins(),
    ]);

    const sessionCount = sessions.length;

    if (sessionCount === 0) {
        return {
            sessionCount: 0,
            camera: null,
            layers: {},
            filters: { note: "No active session -- filter values are not server-tracked." },
            plugins: pluginsResult.plugins,
            ...(pluginsResult.reason !== undefined && { reason: pluginsResult.reason }),
        };
    }

    // Use the most recently active session.
    const sorted = [...sessions].sort((a, b) => b.lastSeen - a.lastSeen);
    const activeSessionId = sorted[0].sessionId;

    const [globeState, catalog] = await Promise.all([
        readGlobeState(userId, activeSessionId),
        readSessionCatalog(userId, activeSessionId),
    ]);

    const camera = globeState
        ? {
              lat: globeState.viewport.lat,
              lon: globeState.viewport.lon,
              altitude: globeState.viewport.altitude,
              heading: globeState.viewport.heading,
              pitch: globeState.viewport.pitch,
          }
        : null;

    const layers = globeState?.layers ?? {};

    // Filter definitions from catalog (browser-published). Applied values are
    // NOT server-tracked -- only definition metadata is available here.
    const filterDefs = catalog?.filterDefinitions ?? {};
    const filters = {
        note: "Applied filter VALUES are not server-tracked. Only filter definitions (fields/types) are available here.",
        definitions: Object.fromEntries(
            Object.entries(filterDefs).map(([pluginId, defs]) => [
                pluginId,
                defs as unknown[],
            ]),
        ),
    };

    return {
        sessionCount,
        camera,
        layers,
        filters,
        plugins: pluginsResult.plugins,
        ...(pluginsResult.reason !== undefined && { reason: pluginsResult.reason }),
    };
}

/** Re-export for convenience so discoveryTools.ts has one import path. */
export { resolveActiveSessionId };

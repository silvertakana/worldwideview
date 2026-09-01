/**
 * @file regionalAnalyticsService.ts
 * @description Computes spatial aggregations, category rollups, and density clusters
 * across streaming entities within a specified bounding box (Gap 2 / Tier 2 analytics).
 */

import type { GeoEntity } from "@worldwideview/wwv-plugin-sdk";
import { fetchPluginSnapshot, getAllPluginSnapshots } from "@/lib/data-query/service";
import type { PluginDataSnapshot } from "@/lib/data-query/types";

export interface RegionalAnalyticsOptions {
    north: number;
    south: number;
    east: number;
    west: number;
    pluginId?: string;
    pluginIds?: string[];
    groupBy?: string;
    clusterResolution?: number;
    topN?: number;
}

export interface SpatialCluster {
    cellId: string;
    center: {
        lat: number;
        lon: number;
    };
    bounds: {
        north: number;
        south: number;
        east: number;
        west: number;
    };
    count: number;
    byPlugin: Record<string, number>;
}

export interface RegionalAnalyticsResult {
    totalCount: number;
    byPlugin: Record<string, number>;
    breakdown?: Record<string, number>;
    clusters: SpatialCluster[];
    bounds: {
        north: number;
        south: number;
        east: number;
        west: number;
    };
    emptyReason?: "plugin_not_streaming" | "no_data_matches";
}

/**
 * Normalizes longitude to [-180, 180].
 */
function normalizeLon(lon: number): number {
    let l = ((lon + 180) % 360 + 360) % 360 - 180;
    if (l === -180 && lon > 0) l = 180;
    return l;
}

/**
 * Computes regional analytics across streaming entities.
 */
export async function getRegionalAnalytics(
    options: RegionalAnalyticsOptions,
): Promise<RegionalAnalyticsResult> {
    const {
        north,
        south,
        east,
        west,
        pluginId,
        pluginIds,
        groupBy,
        clusterResolution = 4,
        topN = 10,
    } = options;

    if (isNaN(north) || isNaN(south) || isNaN(east) || isNaN(west)) {
        throw new Error("Invalid bounding box: north/south/east/west must all be valid numbers");
    }

    if (north < south) {
        throw new Error("Invalid bounding box: north latitude must be greater than or equal to south latitude");
    }

    const isAntimeridian = east < west;

    // Determine target plugins and retrieve snapshots
    let snapshots: PluginDataSnapshot[] = [];
    let requestedPluginNotFound = false;

    if (pluginId) {
        const snap = await fetchPluginSnapshot(pluginId);
        if (!snap) {
            return {
                totalCount: 0,
                byPlugin: {},
                clusters: [],
                bounds: { north, south, east, west },
                emptyReason: "plugin_not_streaming",
            };
        }
        snapshots = [snap];
    } else if (pluginIds && pluginIds.length > 0) {
        const fetched = await Promise.all(pluginIds.map(fetchPluginSnapshot));
        snapshots = fetched.filter((s): s is PluginDataSnapshot => s !== null);
        if (snapshots.length === 0) {
            requestedPluginNotFound = true;
        }
    } else {
        snapshots = await getAllPluginSnapshots();
        if (snapshots.length === 0) {
            requestedPluginNotFound = true;
        }
    }

    if (requestedPluginNotFound) {
        return {
            totalCount: 0,
            byPlugin: {},
            clusters: [],
            bounds: { north, south, east, west },
            emptyReason: "plugin_not_streaming",
        };
    }

    // Filter entities inside bounding box
    const matchedEntities: GeoEntity[] = [];
    const byPlugin: Record<string, number> = {};

    for (const snapshot of snapshots) {
        for (const entity of snapshot.entities) {
            const { latitude: lat, longitude: lon } = entity;
            if (typeof lat !== "number" || typeof lon !== "number") continue;
            if (lat < south || lat > north) continue;

            const inLon = isAntimeridian
                ? lon >= west || lon <= east
                : lon >= west && lon <= east;

            if (inLon) {
                matchedEntities.push(entity);
                const pId = entity.pluginId || snapshot.pluginId;
                byPlugin[pId] = (byPlugin[pId] ?? 0) + 1;
            }
        }
    }

    if (matchedEntities.length === 0) {
        return {
            totalCount: 0,
            byPlugin: {},
            clusters: [],
            bounds: { north, south, east, west },
            emptyReason: "no_data_matches",
        };
    }

    // GroupBy Breakdown
    let breakdown: Record<string, number> | undefined;
    if (groupBy) {
        const counts: Record<string, number> = {};
        for (const entity of matchedEntities) {
            let val: unknown;
            if (groupBy === "plugin" || groupBy === "pluginId") {
                val = entity.pluginId;
            } else if (groupBy in entity) {
                val = (entity as unknown as Record<string, unknown>)[groupBy];
            } else if (entity.properties && typeof entity.properties === "object") {
                val = entity.properties[groupBy];
            }

            const strVal = val !== undefined && val !== null ? String(val).trim() : "unknown";
            const finalKey = strVal === "" ? "unknown" : strVal;
            counts[finalKey] = (counts[finalKey] ?? 0) + 1;
        }

        // Limit to topN with "other"
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        if (sorted.length > topN) {
            const top = sorted.slice(0, topN);
            const otherCount = sorted.slice(topN).reduce((acc, [, c]) => acc + c, 0);
            breakdown = Object.fromEntries(top);
            if (otherCount > 0) {
                breakdown.other = (breakdown.other ?? 0) + otherCount;
            }
        } else {
            breakdown = Object.fromEntries(sorted);
        }
    }

    // Compute Spatial Grid Clusters
    const res = Math.max(1, Math.min(clusterResolution, 10));
    const latSpan = north - south;
    const lonSpan = isAntimeridian ? 360 - (west - east) : east - west;

    const latStep = latSpan > 0 ? latSpan / res : 1;
    const lonStep = lonSpan > 0 ? lonSpan / res : 1;

    const gridCells = new Map<
        string,
        {
            r: number;
            c: number;
            entities: GeoEntity[];
            byPlugin: Record<string, number>;
        }
    >();

    for (const entity of matchedEntities) {
        const { latitude: lat, longitude: lon } = entity;
        const r = Math.min(res - 1, Math.max(0, Math.floor((lat - south) / (latStep || 1))));

        let lonOffset = lon - west;
        if (isAntimeridian && lonOffset < 0) {
            lonOffset += 360;
        }
        const c = Math.min(res - 1, Math.max(0, Math.floor(lonOffset / (lonStep || 1))));

        const key = `${r}:${c}`;
        let cell = gridCells.get(key);
        if (!cell) {
            cell = { r, c, entities: [], byPlugin: {} };
            gridCells.set(key, cell);
        }
        cell.entities.push(entity);
        const pId = entity.pluginId;
        cell.byPlugin[pId] = (cell.byPlugin[pId] ?? 0) + 1;
    }

    const clusters: SpatialCluster[] = [];
    for (const [key, cell] of gridCells.entries()) {
        const cellSouth = south + cell.r * latStep;
        const cellNorth = Math.min(north, cellSouth + latStep);

        const cellWest = normalizeLon(west + cell.c * lonStep);
        const cellEast = normalizeLon(west + (cell.c + 1) * lonStep);

        const avgLat =
            cell.entities.reduce((sum, e) => sum + e.latitude, 0) / cell.entities.length;
        const avgLon =
            cell.entities.reduce((sum, e) => sum + e.longitude, 0) / cell.entities.length;

        clusters.push({
            cellId: `grid-${key}`,
            center: {
                lat: Number(avgLat.toFixed(4)),
                lon: Number(avgLon.toFixed(4)),
            },
            bounds: {
                north: Number(cellNorth.toFixed(4)),
                south: Number(cellSouth.toFixed(4)),
                east: Number(cellEast.toFixed(4)),
                west: Number(cellWest.toFixed(4)),
            },
            count: cell.entities.length,
            byPlugin: cell.byPlugin,
        });
    }

    clusters.sort((a, b) => b.count - a.count);

    return {
        totalCount: matchedEntities.length,
        byPlugin,
        ...(breakdown && { breakdown }),
        clusters,
        bounds: { north, south, east, west },
    };
}

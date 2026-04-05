import type { AnimatableItem } from "./EntityRenderer";

/** Calculate dynamic grid size based on camera altitude. */
export function calculateGridSizeDegrees(altitude: number): number {
    return Math.max(0.005, (altitude * 0.05) / 111320);
}

/** Group lat/lon by dynamic grid size to support zoom-based clustering. */
export function coordKey(pluginId: string, lat: number, lon: number, gridSizeDegrees: number): string {
    const gridLat = Math.round(lat / gridSizeDegrees) * gridSizeDegrees;
    const gridLon = Math.round(lon / gridSizeDegrees) * gridSizeDegrees;
    return `${pluginId}_${gridLat.toFixed(4)},${gridLon.toFixed(4)}`;
}

/** Compute candidate grouping without mutating state. */
export function computeGroups(existingMap: Map<string, AnimatableItem>, gridSize: number): Map<string, AnimatableItem[]> {
    const groups = new Map<string, AnimatableItem[]>();
    for (const item of existingMap.values()) {
        const key = coordKey(item.entity.pluginId, item.entity.latitude, item.entity.longitude, gridSize);
        let list = groups.get(key);
        if (!list) { list = []; groups.set(key, list); }
        list.push(item);
    }
    return groups;
}

/** Count how many entities are in groups of 2+. */
export function countGroupedEntities(groups: Map<string, AnimatableItem[]>): number {
    let count = 0;
    for (const items of groups.values()) {
        if (items.length >= 2) count += items.length;
    }
    return count;
}

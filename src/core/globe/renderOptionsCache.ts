/**
 * DOD Optimization 2: Memoize plugin.renderEntity() results.
 *
 * For static entities (GeoJSON points, military bases, embassies, nuclear sites)
 * the CesiumEntityOptions never change between renders. Caching them avoids
 * thousands of redundant object literal allocations, color lookups, and
 * string concatenations per render cycle.
 *
 * Dynamic entities (aviation with heading/altitude changes) use a
 * content-sensitive key so the cache invalidates when relevant fields change.
 */
import type { WorldPlugin, GeoEntity, CesiumEntityOptions } from "@worldwideview/wwv-plugin-sdk";

/** Composite cache key → rendered options */
const cache = new Map<string, CesiumEntityOptions>();

/**
 * Maximum cache size to prevent unbounded growth if entity IDs churn.
 * 50 000 entries ≈ ~5 MB worst case (shallow option objects).
 */
const MAX_CACHE_SIZE = 50_000;

/**
 * Returns cached CesiumEntityOptions for the given entity, falling
 * back to plugin.renderEntity() on a miss.
 *
 * Key strategy:
 *  - Static entities (no speed): keyed only by entity.id
 *  - Dynamic entities (speed > 0): keyed by id + heading + altitude
 *    so options recompute when visual appearance changes.
 */
export function getCachedRenderOptions(
    plugin: WorldPlugin,
    entity: GeoEntity
): CesiumEntityOptions {
    const heatKey =
        typeof entity.properties?.cveHeat === 'number'
            ? `:cve:${entity.properties.cveHeat.toFixed(4)}`
            : '';
    const key = entity.speed
        ? `${entity.id}:${entity.heading ?? 0}:${entity.altitude ?? 0}`
        : `${entity.id}${heatKey}`;

    const hit = cache.get(key);
    if (hit) return hit;

    const options = plugin.renderEntity(entity);
    // Evict oldest half when cache is full (simple bounded eviction)
    if (cache.size >= MAX_CACHE_SIZE) {
        const deleteCount = MAX_CACHE_SIZE / 2;
        let deleted = 0;
        for (const k of cache.keys()) {
            if (deleted >= deleteCount) break;
            cache.delete(k);
            deleted++;
        }
    }
    cache.set(key, options);
    return options;
}

/** Clear the entire render options cache (e.g. on plugin reload). */
export function clearRenderOptionsCache(): void {
    cache.clear();
}

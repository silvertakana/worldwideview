import type { CameraAdapter, CameraAdapterMeta, CameraFeature } from "./types";
import { caltransAdapter } from "./caltrans";
import { gdotAdapter } from "./gdot";
import { tflAdapter } from "./tfl";
import { ny511Adapter } from "./ny511";
import { wsdotAdapter } from "./wsdot";

/**
 * All registered adapters. To add a new source, add an import + push the
 * adapter object here. No other file needs to change for the new source
 * to appear in `/api/camera/list`, `/api/camera/traffic?sources=...`, and
 * the client's source-picker UI.
 */
export const ALL_ADAPTERS: CameraAdapter[] = [
    caltransAdapter,
    gdotAdapter,
    tflAdapter,
    ny511Adapter,
    wsdotAdapter,
];

const ADAPTERS_BY_ID: Map<string, CameraAdapter> = new Map(
    ALL_ADAPTERS.map((a) => [a.id, a]),
);

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
    data: CameraFeature[];
    expiry: number;
    fetchedAt: string;
    error?: string;
}

const cache: Map<string, CacheEntry> = new Map();

export function getAdapter(id: string): CameraAdapter | undefined {
    return ADAPTERS_BY_ID.get(id);
}

/**
 * Resolve a `?sources=` query value into a list of adapter ids.
 * - empty / unset / "all" → all known adapter ids
 * - "none" → empty list (clients use this to short-circuit)
 * - comma-separated list → only the registered ones, unknown ids dropped
 */
export function resolveSources(raw: string | null): string[] {
    if (!raw || raw === "all") return ALL_ADAPTERS.map((a) => a.id);
    if (raw === "none") return [];
    const requested = raw.split(",").map((s) => s.trim()).filter(Boolean);
    return requested.filter((id) => ADAPTERS_BY_ID.has(id));
}

function isKeyAvailable(adapter: CameraAdapter): boolean {
    if (!adapter.requiresKey) return true;
    return !!process.env[adapter.requiresKey.envVar];
}

/** Return all adapter metadata for `/api/camera/list`. */
export function getAdapterMetadata(): CameraAdapterMeta[] {
    return ALL_ADAPTERS.map((a) => {
        const c = cache.get(a.id);
        const keyOk = isKeyAvailable(a);
        return {
            id: a.id,
            displayName: a.displayName,
            region: a.region,
            requiresKey: a.requiresKey,
            healthy: keyOk && !!c && !c.error,
            lastFetchedAt: c?.fetchedAt ?? null,
            lastFeatureCount: c ? c.data.length : null,
            lastError: c?.error,
        };
    });
}

/**
 * Fetch a single adapter's data with per-adapter caching.
 * Each adapter has its own TTL (default 24h, overridable via `cacheTtlMs`),
 * so fast sources can refresh hourly while slow ones stay daily.
 *
 * On error: returns the stale cached value if present, or rethrows. Either
 * way, the cache entry's `error` field is set so `/api/camera/list` can
 * report unhealthy adapters.
 */
export async function fetchAdapter(adapter: CameraAdapter): Promise<CameraFeature[]> {
    if (!isKeyAvailable(adapter)) {
        return [];
    }
    const now = Date.now();
    const ttl = adapter.cacheTtlMs ?? DEFAULT_TTL_MS;
    const c = cache.get(adapter.id);
    if (c && now < c.expiry && !c.error) {
        return c.data;
    }
    try {
        const data = await adapter.fetch();
        cache.set(adapter.id, {
            data,
            expiry: now + ttl,
            fetchedAt: new Date(now).toISOString(),
        });
        return data;
    } catch (e: any) {
        const errMsg = e?.message ?? String(e);
        if (c) {
            cache.set(adapter.id, { ...c, error: errMsg });
            return c.data;
        }
        cache.set(adapter.id, {
            data: [],
            expiry: now + 60_000, // short retry window on first failure
            fetchedAt: new Date(now).toISOString(),
            error: errMsg,
        });
        throw e;
    }
}

/** Fetch many adapters in parallel and merge the results. */
export async function fetchManyAdapters(ids: string[]): Promise<CameraFeature[]> {
    const adapters = ids
        .map((id) => ADAPTERS_BY_ID.get(id))
        .filter((a): a is CameraAdapter => !!a);
    const results = await Promise.allSettled(adapters.map(fetchAdapter));
    const out: CameraFeature[] = [];
    for (const r of results) {
        if (r.status === "fulfilled") out.push(...r.value);
    }
    return out;
}

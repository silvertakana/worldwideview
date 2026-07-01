/**
 * @file registry.ts
 * @description LocalDataSource registry — discovers plugins with localData
 * declarations and resolves them to PluginDataSnapshot.
 *
 * Scans public/plugins-local/<id>/plugin.json at runtime, keeps those with a
 * `localData` array, and memoizes the assembled map once per process (separate
 * from the per-source data TTL cache).
 *
 * Security (T-30-03): paths from manifests are constrained to
 *   path.join(process.cwd(), "public", <relative>)
 * and any path containing ".." is rejected before the read.
 */

import { readdir as nodeReaddir, readFile as nodeReadFile } from "node:fs/promises";
import path from "path";
import type { LocalDataSourceDeclaration } from "@worldwideview/wwv-plugin-sdk";
import type { PluginDataSnapshot } from "../types";
import { normalizeGeoJson } from "./normalizers";
import { getCached, TTL_GEOJSON_MS, TTL_ROUTE_MS } from "./cache";

// ---------------------------------------------------------------------------
// Fs reader — injectable for testing (avoids Node built-in mock interop issues)
// ---------------------------------------------------------------------------

type Readdir = (dir: string) => Promise<string[]>;
type Readfile = (p: string, enc: string) => Promise<string>;

let _readdir: Readdir = (dir) => nodeReaddir(dir) as Promise<string[]>;
let _readfile: Readfile = (p, enc) => nodeReadFile(p, enc as "utf-8") as Promise<string>;

/** Exposed for testing ONLY: inject custom fs reader implementations. */
export function _setReaderForTest(rd: Readdir, rf: Readfile): void {
    _readdir = rd;
    _readfile = rf;
}

/** Restore the default fs readers (call in afterEach when using _setReaderForTest). */
export function _restoreReader(): void {
    _readdir = (dir) => nodeReaddir(dir) as Promise<string[]>;
    _readfile = (p, enc) => nodeReadFile(p, enc as "utf-8") as Promise<string>;
}

// ---------------------------------------------------------------------------
// Plugin ID validator (mirrors service.ts — defense in depth)
// ---------------------------------------------------------------------------

const PLUGIN_ID_RE = /^[a-zA-Z0-9_-]+$/;

function validatePluginId(id: string): boolean {
    return PLUGIN_ID_RE.test(id);
}

// ---------------------------------------------------------------------------
// Registry entry
// ---------------------------------------------------------------------------

interface RegistryEntry {
    pluginId: string;
    sources: LocalDataSourceDeclaration[];
}

// T-30-01: only allow known source types — drop anything else at registry scan time.
const ALLOWED_SOURCE_TYPES = new Set(["geojson", "route"]);

// Memoized map: built once per process from disk, keyed by plugin id.
let registryPromise: Promise<Map<string, RegistryEntry>> | null = null;

/**
 * Reads all generated plugin.json manifests from public/plugins-local/<id>/
 * and returns a Map of { id -> RegistryEntry } for those that declare localData.
 * Result is memoized — only one scan per process lifetime.
 */
function getRegistry(): Promise<Map<string, RegistryEntry>> {
    if (registryPromise !== null) return registryPromise;

    registryPromise = (async () => {
        const map = new Map<string, RegistryEntry>();
        const pluginsDir = path.join(process.cwd(), "public", "plugins-local");

        let entries: string[];
        try {
            entries = await _readdir(pluginsDir);
        } catch {
            return map;
        }

        for (const entry of entries) {
            const manifestPath = path.join(pluginsDir, entry, "plugin.json");
            let raw: string;
            try {
                raw = await _readfile(manifestPath, "utf-8");
            } catch {
                continue;
            }

            let manifest: Record<string, unknown>;
            try {
                manifest = JSON.parse(raw) as Record<string, unknown>;
            } catch {
                continue;
            }

            const id = manifest.id as string | undefined;
            if (typeof id !== "string" || !validatePluginId(id)) continue;

            const localData = manifest.localData;
            if (!Array.isArray(localData) || localData.length === 0) continue;

            const sources = (localData as unknown[]).filter(
                (s): s is LocalDataSourceDeclaration => {
                    if (typeof s !== "object" || s === null) return false;
                    const src = s as Record<string, unknown>;
                    // T-30-01: only allow known types (geojson, route) — drop any other.
                    return (
                        typeof src.name === "string" &&
                        typeof src.type === "string" &&
                        ALLOWED_SOURCE_TYPES.has(src.type) &&
                        typeof src.path === "string"
                    );
                },
            );

            if (sources.length === 0) continue;

            map.set(id, { pluginId: id, sources });
        }

        return map;
    })();

    return registryPromise;
}

// ---------------------------------------------------------------------------
// Path guard (T-30-03 — path traversal)
// ---------------------------------------------------------------------------

function isSafeRelativePath(p: string): boolean {
    return !p.includes("..");
}

// ---------------------------------------------------------------------------
// Source resolver helpers
// ---------------------------------------------------------------------------

/**
 * Read a geojson source from disk (no self-HTTP — Pitfall 3).
 * Path is constrained to process.cwd()/public/<relative>.
 */
async function fetchGeojsonSource(
    sourcePath: string,
    pluginId: string,
    prefix: string,
): Promise<PluginDataSnapshot> {
    if (!isSafeRelativePath(sourcePath)) {
        throw new Error(`[localSources] Rejected unsafe path: ${sourcePath}`);
    }

    // Strip leading "/" if present — path.join handles this correctly
    const relativePart = sourcePath.startsWith("/") ? sourcePath.slice(1) : sourcePath;
    const absolutePath = path.join(process.cwd(), "public", relativePart);

    // T-30-03 defense-in-depth: ensure resolved path stays inside public/
    const publicRoot = path.join(process.cwd(), "public") + path.sep;
    if (!absolutePath.startsWith(publicRoot)) {
        throw new Error(`[localSources] Path escapes public/: ${sourcePath}`);
    }

    const raw = await _readfile(absolutePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    const entities = normalizeGeoJson(parsed, prefix, pluginId);

    return { pluginId, entities, timestamp: new Date() };
}

/**
 * Fetch a route source via the internal Next.js API (server-side fetch).
 * Base URL is derived from env variable or defaults to localhost:3000.
 */
async function fetchRouteSource(
    sourcePath: string,
    pluginId: string,
    prefix: string,
): Promise<PluginDataSnapshot> {
    if (!isSafeRelativePath(sourcePath)) {
        throw new Error(`[localSources] Rejected unsafe path: ${sourcePath}`);
    }

    // T-30-01 SSRF guard: only relative paths (starting with "/") are allowed.
    // An absolute URL (containing "://") or a non-slash-prefixed path would
    // resolve against the base and could reach external hosts.
    if (!sourcePath.startsWith("/") || sourcePath.includes("://")) {
        throw new Error(`[localSources] Rejected non-relative route path: ${sourcePath}`);
    }

    const base = process.env.WWV_INTERNAL_BASE_URL ?? "http://localhost:3000";
    const url = new URL(sourcePath, base).toString();

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
        return { pluginId, entities: [], timestamp: new Date() };
    }

    const parsed: unknown = await res.json();
    const entities = normalizeGeoJson(parsed, prefix, pluginId);

    return { pluginId, entities, timestamp: new Date() };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true if the given plugin id has a localData declaration.
 */
export async function hasLocalSource(id: string): Promise<boolean> {
    const registry = await getRegistry();
    return registry.has(id);
}

/**
 * Returns the Set of all plugin ids that have localData declarations.
 */
export async function getLocalSourceIds(): Promise<Set<string>> {
    const registry = await getRegistry();
    return new Set(registry.keys());
}

/**
 * Resolves ALL declared local sources for a plugin, merges entities from each,
 * and returns a single aggregated PluginDataSnapshot.
 *
 * Cache keys are scoped per source ("camera:default", "camera:traffic") so
 * each source has its own TTL, then combined at read time.
 */
export async function resolveLocalSnapshot(id: string): Promise<PluginDataSnapshot> {
    const registry = await getRegistry();
    const entry = registry.get(id);

    if (entry === undefined) {
        throw new Error(`[localSources] No local source registered for plugin: ${id}`);
    }

    const allEntities = await Promise.all(
        entry.sources.map((source) => {
            const cacheKey = `${id}:${source.name}`;
            const ttl = source.type === "geojson" ? TTL_GEOJSON_MS : TTL_ROUTE_MS;

            return getCached(cacheKey, ttl, () => {
                if (source.type === "geojson") {
                    return fetchGeojsonSource(source.path, id, source.name);
                }
                return fetchRouteSource(source.path, id, source.name);
            });
        }),
    );

    // Merge all source entities into a single snapshot
    const mergedEntities = allEntities.flatMap((snap) => snap.entities);

    return {
        pluginId: id,
        entities: mergedEntities,
        timestamp: new Date(),
    };
}

/** Exposed for testing: reset the memoized registry (allows re-scan in tests). */
export function _resetRegistry(): void {
    registryPromise = null;
}

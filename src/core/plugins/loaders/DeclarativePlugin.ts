import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
    PluginCategory,
} from "../PluginTypes";
import type { PluginManifest } from "../PluginManifest";
import { getNestedValue } from "./getNestedValue";
import { mapGeoJsonToEntities } from "./mapGeoJsonToEntities";
import { mapJsonToEntities } from "./mapJsonToEntities";

/**
 * Generic WorldPlugin implementation for declarative (JSON-only) plugins.
 * Reads a PluginManifest to know where to fetch, how to parse, and how to render.
 */
export class DeclarativePlugin implements WorldPlugin {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly icon: string;
    readonly category: PluginCategory;
    readonly version: string;

    private context: PluginContext | null = null;

    constructor(private readonly manifest: PluginManifest) {
        this.id = manifest.id;
        this.name = manifest.name;
        this.description = manifest.description ?? "";
        this.icon = manifest.icon ?? "📦";
        this.category = manifest.category as PluginCategory;
        this.version = manifest.version;
    }

    async initialize(ctx: PluginContext): Promise<void> {
        this.context = ctx;
    }

    destroy(): void {
        this.context = null;
    }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        const ds = this.manifest.dataSource;
        if (!ds) return [];

        try {
            const url = this.buildUrl(ds.url);
            const headers = this.buildHeaders();

            const res = await fetch(url, {
                method: ds.method ?? "GET",
                headers,
                ...(ds.body ? { body: JSON.stringify(ds.body) } : {}),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            return this.parseResponse(data);
        } catch (err) {
            console.error(`[DeclarativePlugin:${this.id}] Fetch error:`, err);
            return [];
        }
    }

    getPollingInterval(): number {
        return this.manifest.dataSource?.pollInterval ?? 30_000;
    }

    getLayerConfig(): LayerConfig {
        const r = this.manifest.rendering;
        return {
            color: r?.color ?? "#3b82f6",
            clusterEnabled: r?.clusterEnabled ?? true,
            clusterDistance: r?.clusterDistance ?? 40,
            maxEntities: r?.maxEntities,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const r = this.manifest.rendering;
        const type = r?.entityType === "billboard" ? "billboard" : "point";
        return {
            type,
            color: r?.color ?? "#3b82f6",
            size: r?.maxEntities ? undefined : 6,
            iconUrl: r?.icon,
            labelText: entity.label ?? undefined,
        };
    }

    // ── Private helpers ─────────────────────────────────────

    private buildUrl(base: string): string {
        const auth = this.manifest.dataSource?.auth;
        if (auth?.type !== "query") return base;

        const value = this.resolveEnvVar(auth.envVar);
        if (!value) return base;

        const sep = base.includes("?") ? "&" : "?";
        return `${base}${sep}${auth.key}=${encodeURIComponent(value)}`;
    }

    private buildHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            ...(this.manifest.dataSource?.headers ?? {}),
        };
        const auth = this.manifest.dataSource?.auth;
        if (auth?.type === "header") {
            const value = this.resolveEnvVar(auth.envVar);
            if (value) headers[auth.key] = value;
        }
        return headers;
    }

    private resolveEnvVar(name: string): string | undefined {
        if (typeof process !== "undefined" && process.env) {
            return process.env[name] ?? undefined;
        }
        return undefined;
    }

    private parseResponse(data: unknown): GeoEntity[] {
        const format = this.manifest.dataSource?.format ?? "json";
        const mapping = this.manifest.fieldMapping;
        if (!mapping) return [];

        if (format === "geojson") {
            return mapGeoJsonToEntities(data, mapping, this.id);
        }
        return mapJsonToEntities(data, mapping, this.id, this.manifest.dataSource?.arrayPath);
    }
}

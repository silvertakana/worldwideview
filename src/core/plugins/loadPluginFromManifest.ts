// ─── Plugin Loader Router ────────────────────────────────────
// Given a PluginManifest, instantiates the correct plugin implementation.
// Routes: declarative → DeclarativePlugin, static → StaticDataPlugin,
//         bundle → dynamic import.

import type { WorldPlugin } from "./PluginTypes";
import type { PluginManifest } from "./PluginManifest";
import { validateManifest } from "./validateManifest";
import { DeclarativePlugin } from "./loaders/DeclarativePlugin";
import { StaticDataPlugin } from "./loaders/StaticDataPlugin";
import type { GeoJsonFeatureCollection } from "@/types/geojson";

export class ManifestLoadError extends Error {
    constructor(
        public readonly manifestId: string,
        message: string,
        public readonly validationErrors?: string[],
    ) {
        super(`[ManifestLoad:${manifestId}] ${message}`);
        this.name = "ManifestLoadError";
    }
}

/** Load a static GeoJSON file referenced by a static-format manifest. */
async function loadGeoJsonFile(dataFile: string): Promise<GeoJsonFeatureCollection> {
    const res = await fetch(dataFile);
    if (!res.ok) {
        throw new Error(`Failed to load GeoJSON file "${dataFile}": HTTP ${res.status}`);
    }
    return res.json() as Promise<GeoJsonFeatureCollection>;
}

/** Load a bundle-format plugin via dynamic import. */
async function loadBundlePlugin(entry: string): Promise<WorldPlugin> {
    const module = await import(/* webpackIgnore: true */ entry);
    const PluginClass = module.default ?? module;

    // Handle both class exports and instance exports
    if (typeof PluginClass === "function") {
        return new PluginClass() as WorldPlugin;
    }
    return PluginClass as WorldPlugin;
}

/**
 * Given a PluginManifest, returns a fully constructed WorldPlugin instance.
 *
 * @throws ManifestLoadError if validation fails or loading fails
 */
export async function loadPluginFromManifest(
    manifest: PluginManifest,
): Promise<WorldPlugin> {
    // 1. Validate
    const result = validateManifest(manifest);
    if (!result.valid) {
        throw new ManifestLoadError(
            manifest.id,
            `Invalid manifest: ${result.errors.join(", ")}`,
            result.errors,
        );
    }

    // 2. Route by format
    try {
        switch (manifest.format) {
            case "declarative":
                return new DeclarativePlugin(manifest);

            case "static": {
                const geojson = await loadGeoJsonFile(manifest.dataFile!);
                return new StaticDataPlugin(manifest, geojson.features);
            }

            case "bundle":
                return await loadBundlePlugin(manifest.entry!);

            default:
                throw new ManifestLoadError(
                    manifest.id,
                    `Unknown format: "${manifest.format}"`,
                );
        }
    } catch (err) {
        if (err instanceof ManifestLoadError) throw err;
        throw new ManifestLoadError(
            manifest.id,
            `Failed to load plugin: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
}

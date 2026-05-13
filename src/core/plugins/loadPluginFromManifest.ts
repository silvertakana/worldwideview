/**
 * @file loadPluginFromManifest.ts
 * @description Handles the dynamic loading and instantiation of WorldWideView plugins from ES module bundles.
 */

import type { WorldPlugin } from "./PluginTypes";
import type { PluginManifest } from "./PluginManifest";
import { validateManifest } from "./validateManifest";

/**
 * Custom error class for failures occurring during the plugin manifest loading process.
 * Includes detailed validation errors to help developers debug malformed marketplace bundles.
 */
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

/**
 * Orchestrates the dynamic ES module import of a plugin bundle.
 * This method is the core of our "Bundled Plugin" architecture, bypassing standard 
 * build-time dependencies to load external code at runtime. It aggressively 
 * probes the imported module for a valid WorldPlugin implementation, checking 
 * default exports, named class exports, and object literals with 'initialize' hooks.
 * 
 * @param entry - The URL or path to the ES module entry point (e.g., unpkg.com URL).
 * @returns A promise resolving to an instantiated WorldPlugin implementation.
 * @throws Error if the module cannot be reached or no valid plugin interface is discovered.
 */
async function loadBundlePlugin(entry: string): Promise<WorldPlugin> {
    const module = await import(/* webpackIgnore: true */ entry);

    /**
     * Helper to safely instantiate a class and verify its compliance with WorldPlugin.
     */
    const instantiate = (maybeClass: any): WorldPlugin | null => {
        if (typeof maybeClass === "function") {
            try {
                const instance = new maybeClass();
                if (instance && typeof instance.initialize === "function") {
                    return instance as WorldPlugin;
                }
            } catch {
                return null;
            }
        }
        return null;
    };

    if (module.default) {
        if (typeof module.default === "function") {
            return new module.default() as WorldPlugin;
        }
        return module.default as WorldPlugin;
    }

    // Probe all named exports for a class implementation
    for (const key in module) {
        const instance = instantiate(module[key]);
        if (instance) return instance;
    }

    // Fallback: check for object literals that look like plugins (legacy/utility bundles)
    for (const key in module) {
        const exp = module[key];
        if (exp && typeof exp === "object" && typeof exp.initialize === "function") {
            return exp as WorldPlugin;
        }
    }

    throw new Error(
        `Failed to load valid WorldPlugin from bundle: ${entry}. ` +
        `Make sure you export a class that implements WorldPlugin.`,
    );
}

/**
 * Validates a plugin manifest and returns a fully constructed WorldPlugin instance.
 * This is the primary system entry point for turning a JSON marketplace declaration 
 * into a live, interactive data layer. It enforces strict schema validation 
 * before attempting the expensive network request for the module bundle.
 * 
 * @param manifest - The raw JSON manifest declaration for the plugin.
 * @returns A promise resolving to a constructed WorldPlugin.
 * @throws ManifestLoadError if the schema is invalid or the network bundle fails to resolve.
 */
export async function loadPluginFromManifest(
    manifest: PluginManifest,
): Promise<WorldPlugin> {
    const result = validateManifest(manifest);
    if (!result.valid) {
        console.error(
            `[loadPluginFromManifest] ❌ VALIDATION FAILED for "${manifest.id || "unknown"}"\n` +
            `Errors: ${result.errors.join(", ")}\n` +
            `Payload:\n${JSON.stringify(manifest, null, 2)}`,
        );
        throw new ManifestLoadError(
            manifest.id,
            `Invalid manifest: ${result.errors.join(", ")}`,
            result.errors,
        );
    }

    try {
        return await loadBundlePlugin(manifest.entry!);
    } catch (err) {
        if (err instanceof ManifestLoadError) throw err;
        throw new ManifestLoadError(
            manifest.id,
            `Failed to load plugin: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
}

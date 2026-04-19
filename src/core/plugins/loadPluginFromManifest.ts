// ─── Plugin Loader ───────────────────────────────────────────
// All plugins are bundles. Given a manifest, dynamically import
// the entry and return a WorldPlugin instance.

import type { WorldPlugin } from "./PluginTypes";
import type { PluginManifest } from "./PluginManifest";
import { validateManifest } from "./validateManifest";

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

/** Load a bundle plugin via dynamic import. */
async function loadBundlePlugin(entry: string): Promise<WorldPlugin> {
    const module = await import(/* webpackIgnore: true */ entry);

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

    for (const key in module) {
        const instance = instantiate(module[key]);
        if (instance) return instance;
    }

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
 * Given a PluginManifest, returns a fully constructed WorldPlugin instance.
 * @throws ManifestLoadError if validation fails or loading fails
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

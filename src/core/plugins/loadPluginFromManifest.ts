/* eslint-disable no-console */
/**
 * @file loadPluginFromManifest.ts
 * @description Handles the dynamic loading and instantiation of WorldWideView plugins from ES module bundles.
 */

import type { WorldPlugin } from "./PluginTypes";
import type { PluginManifest } from "./PluginManifest";
import { validateManifest } from "./validateManifest";
import { getMissingPluginMethods, REQUIRED_PLUGIN_METHODS } from "./pluginContract";

export { getMissingPluginMethods, isWorldPlugin } from "./pluginContract";

/**
 * Custom error class for failures occurring during the plugin manifest loading process.
 * Includes detailed validation errors to help developers debug malformed marketplace bundles.
 */
/**
 * Why a manifest failed to load. Callers use this to decide whether a retry
 * can ever succeed:
 * - `validation`   — the manifest itself is malformed. Permanent.
 * - `incompatible` — the bundle loaded but does not implement WorldPlugin
 *                    (built against another plugin API). Permanent.
 * - `network`      — the bundle could not be fetched/evaluated. Transient.
 */
export type ManifestLoadFailure = "validation" | "incompatible" | "network";

export class ManifestLoadError extends Error {
    constructor(
        public readonly manifestId: string,
        message: string,
        public readonly validationErrors?: string[],
        public readonly failure: ManifestLoadFailure = "network",
    ) {
        super(`[ManifestLoad:${manifestId}] ${message}`);
        this.name = "ManifestLoadError";
    }

    /** True when retrying the same manifest can never succeed. */
    get isPermanent(): boolean {
        return this.failure !== "network";
    }
}

/**
 * Thrown by `loadBundlePlugin` when the module evaluated fine but exported
 * nothing that implements WorldPlugin. Carries the closest candidate's
 * missing methods so the developer sees exactly which contract they missed.
 */
class IncompatibleBundleError extends Error {
    constructor(public readonly missing: string[]) {
        super(`Bundle does not implement WorldPlugin (missing: ${missing.join(", ")})`);
        this.name = "IncompatibleBundleError";
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

    // Track the most plugin-like export so an incompatible bundle reports
    // *which* methods it is missing instead of a generic failure.
    let closestMissing: string[] | null = null;
    const consider = (candidate: unknown): WorldPlugin | null => {
        if (!candidate || (typeof candidate !== "object" && typeof candidate !== "function")) return null;
        const missing = getMissingPluginMethods(candidate);
        if (missing.length === 0) return candidate as WorldPlugin;
        if (closestMissing === null || missing.length < closestMissing.length) closestMissing = missing;
        return null;
    };

    /**
     * Helper to safely instantiate a class and verify its compliance with WorldPlugin.
     */
    const instantiate = (maybeClass: unknown): WorldPlugin | null => {
        if (typeof maybeClass !== "function") return null;
        try {
            const Constructor = maybeClass as new () => unknown;
            return consider(new Constructor());
        } catch {
            return null;
        }
    };

    // 1. Default export: class or ready-made instance/object literal.
    if (module.default) {
        const fromDefault = typeof module.default === "function"
            ? instantiate(module.default)
            : consider(module.default);
        if (fromDefault) return fromDefault;
    }

    // 2. Probe all named exports for a class implementation.
    for (const key in module) {
        if (key === "default") continue;
        const instance = instantiate(module[key]);
        if (instance) return instance;
    }

    // 3. Fallback: object literals that implement the contract (legacy/utility bundles).
    for (const key in module) {
        if (key === "default") continue;
        const exp = module[key];
        if (exp && typeof exp === "object") {
            const instance = consider(exp);
            if (instance) return instance;
        }
    }

    throw new IncompatibleBundleError(closestMissing ?? [...REQUIRED_PLUGIN_METHODS]);
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
            `[loadPluginFromManifest] ❌ VALIDATION FAILED for "${manifest.id || "unknown"}"\n`
            + `Errors: ${result.errors.join(", ")}\n`
            + `Payload:\n${JSON.stringify(manifest, null, 2)}`,
        );
        throw new ManifestLoadError(
            manifest.id,
            `Invalid manifest: ${result.errors.join(", ")}`,
            result.errors,
            "validation",
        );
    }

    try {
        return await loadBundlePlugin(manifest.entry!);
    } catch (err) {
        if (err instanceof ManifestLoadError) throw err;
        if (err instanceof IncompatibleBundleError) {
            // A warning, not an error: the host skips the bundle cleanly and
            // tells the user. The message is for the plugin's author.
            console.warn(
                `[loadPluginFromManifest] ❌ INCOMPATIBLE BUNDLE "${manifest.id}" (${manifest.entry}):\n`
                + `  The module loaded but none of its exports implement WorldPlugin.\n`
                + `  Missing methods: ${err.missing.join(", ")}\n`
                + `  The bundle was likely built against a different plugin API. Export a class\n`
                + `  (or object) with initialize/fetch/getPollingInterval/destroy from\n`
                + `  @worldwideview/wwv-plugin-sdk and republish.`,
            );
            throw new ManifestLoadError(
                manifest.id,
                `Bundle does not implement the WorldPlugin interface (missing ${err.missing.join(", ")}). It was built for a different plugin API and was skipped.`,
                undefined,
                "incompatible",
            );
        }
        const rawMsg = err instanceof Error ? err.message : String(err);
        // Browser throws "Failed to resolve module specifier" when the bundle imports
        // a bare module that is not on the host pantry. Guide the developer to fix it.
        const bareImportMatch = rawMsg.match(/Failed to resolve module specifier "([^"]+)"/);
        if (bareImportMatch) {
            const specifier = bareImportMatch[1];
            console.error(
                `[loadPluginFromManifest] ❌ BUNDLING ERROR in plugin "${manifest.id}":\n`
                + `  Unsatisfied bare import: "${specifier}"\n`
                + `  This module is not on the host pantry — your plugin must bundle it.\n`
                + `  Fix: move "${specifier}" to your plugin's "dependencies" (not "peerDependencies")\n`
                + `  and rebuild so Vite/Rollup inlines it into the bundle.\n`
                + `  Host pantry (never bundle these — host provides them):\n`
                + `    react, react-dom, cesium, resium, zustand,\n`
                + `    @worldwideview/wwv-plugin-sdk, @/core/state/store,\n`
                + `    @/core/plugins/PluginManager, @/components/video/CameraStream`,
            );
            throw new ManifestLoadError(
                manifest.id,
                `Unsatisfied bare import "${specifier}" — bundle it in dependencies, not peerDependencies. See console for the full host pantry list.`,
                undefined,
                "incompatible",
            );
        }
        throw new ManifestLoadError(
            manifest.id,
            `Failed to load plugin: ${rawMsg}`,
        );
    }
}

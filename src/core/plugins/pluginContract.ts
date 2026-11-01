/**
 * @file pluginContract.ts
 * @description Runtime checks for the WorldPlugin contract. Kept separate from
 * the loader so the PluginManager can validate instances without importing the
 * (often mocked) dynamic-import machinery.
 */

import type { WorldPlugin } from "./PluginTypes";

/** Methods every WorldPlugin instance must expose before the host may drive it. */
export const REQUIRED_PLUGIN_METHODS = ["initialize", "fetch", "getPollingInterval", "destroy"] as const;

/**
 * Returns the WorldPlugin methods a candidate object is missing. An empty list
 * means the object can safely be registered with the PluginManager.
 */
export function getMissingPluginMethods(candidate: unknown): string[] {
    if (!candidate || (typeof candidate !== "object" && typeof candidate !== "function")) {
        return [...REQUIRED_PLUGIN_METHODS];
    }
    const record = candidate as Record<string, unknown>;
    return REQUIRED_PLUGIN_METHODS.filter((method) => typeof record[method] !== "function");
}

/** Type guard: does this value implement the WorldPlugin runtime contract? */
export function isWorldPlugin(candidate: unknown): candidate is WorldPlugin {
    return getMissingPluginMethods(candidate).length === 0;
}

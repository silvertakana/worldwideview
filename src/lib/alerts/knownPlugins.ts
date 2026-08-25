/**
 * Known plugin channel names for alert-rule validation (P2, v1).
 *
 * The runtime union of "channels whose data can reach the app's dataBus":
 *   1. Built-in plugins shipped in this repo (src/plugins/* — always valid).
 *   2. Engine-seeded channels advertised by the data engine manifest
 *      (graceful — unreachable engine degrades to the built-ins).
 *   3. Local-registry plugin ids (public/plugins-local manifests, see
 *      data-query/localSources).
 */

import { getEngineUrl } from "@/lib/data-query/service";

/** Built-in plugin ids shipped in src/plugins (channel names are folder ids). */
const BUILTIN_ALERTABLE_PLUGIN_IDS = ["earthquakes", "geojson", "iss", "weather"];

/**
 * Resolve the set of plugin ids that are valid alert-rule targets.
 * @param fetcher - injectable for tests; defaults to global fetch.
 */
export async function getKnownPluginIds(
    fetcher: typeof fetch = fetch,
): Promise<Set<string>> {
    const ids = new Set<string>(BUILTIN_ALERTABLE_PLUGIN_IDS);

    try {
        const res = await fetcher(`${getEngineUrl()}/manifest`, {
            signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
            const data = (await res.json()) as { plugins?: unknown };
            if (Array.isArray(data.plugins)) {
                for (const id of data.plugins) {
                    if (typeof id === "string") ids.add(id);
                }
            }
        }
    } catch {
        // Engine offline — built-ins still validate.
    }

    try {
        const { getLocalSourceIds } = await import("@/lib/data-query/localSources");
        for (const id of await getLocalSourceIds()) {
            ids.add(id);
        }
    } catch {
        // Local registry unavailable (e.g. test env without public/plugins-local).
    }

    return ids;
}

/** True when pluginId is a channel the app can evaluate alerts against. */
export async function isKnownPluginId(pluginId: string): Promise<boolean> {
    return (await getKnownPluginIds()).has(pluginId);
}
// src/core/data/engineManifest.ts
// Fetches /manifest from a local data engine to discover available seeders.
// Used by resolveEngineUrl for per-plugin local vs cloud routing.

let localManifest: string[] | null = null;
let manifestFetched = false;

/**
 * Resolve the base URL of the local data engine.
 *
 * Priority:
 *   1. `NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL` env var — if the operator
 *      pointed plugins at a specific engine URL (most common in
 *      self-host setups), use that. We strip any trailing `/stream`
 *      since the var is sometimes set to the WebSocket URL.
 *   2. `localhost:5001` — matches the port wwv-data-engine's
 *      docker-compose.yaml binds. The previous default of 5000 was
 *      always wrong: the engine has listened on 5001 since the v2
 *      refactor. Port 5000 is also famously hijacked on macOS by the
 *      AirPlay Receiver, which would return 403 to any GET regardless
 *      of whether an engine was running, so it produced misleading
 *      "no local engine" results on every macOS dev machine.
 */
function getLocalEngineBase() {
    const envUrl = process.env.NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL;
    if (envUrl) {
        // Strip a trailing `/stream` if present (the var is sometimes
        // set to the WebSocket URL); also normalize ws[s]:// to http[s]://.
        return envUrl
            .replace(/\/stream\/?$/, "")
            .replace(/^ws:\/\//, "http://")
            .replace(/^wss:\/\//, "https://")
            .replace(/\/+$/, "");
    }
    if (typeof window === "undefined") return "http://localhost:5001";
    return `${window.location.protocol}//${window.location.hostname}:5001`;
}

/**
 * Fetch the list of available seeders from a local engine.
 * Returns null if no local engine is detected (timeout after 2s).
 */
export async function fetchLocalEngineManifest(): Promise<string[] | null> {
  if (manifestFetched) return localManifest;
  manifestFetched = true;

  try {
    const controller = new AbortController();
    // 500ms is more than enough for a localhost connection.
    const timeout = setTimeout(() => controller.abort(), 500);

    const res = await fetch(`${getLocalEngineBase()}/manifest`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    localManifest = data.plugins || [];
    console.log(
      `[EngineManifest] Local engine detected: ${localManifest!.length} seeders`,
      localManifest
    );
    return localManifest;
  } catch {
    console.log("[EngineManifest] No local engine detected, using cloud.");
    // We intentionally leave manifestFetched = true here.
    // This caches the failure so we don't incur this timeout penalty 
    // every single time a plugin is toggled.
    return null;
  }
}

/** Check if the local engine has a seeder for a given plugin ID. */
export function localEngineHasPlugin(pluginId: string): boolean {
  if (!localManifest) return false;
  return localManifest.includes(pluginId);
}

/** Reset the cache (for testing or reconnection). */
export function resetManifestCache(): void {
  localManifest = null;
  manifestFetched = false;
}

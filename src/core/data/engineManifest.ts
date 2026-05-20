// src/core/data/engineManifest.ts
// Fetches /manifest from a local data engine to discover available seeders.
// Used by resolveEngineUrl for per-plugin local vs cloud routing.

let localManifest: string[] | null = null;
let manifestFetched = false;

/**
 * Resolve the base URL of the local data engine.
 *
 * Always checks localhost:5000 — the port docker-compose.yml binds for
 * wwv-data-engine. NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL is intentionally
 * NOT used here: that variable belongs to each plugin's own declared engine
 * URL (production, third-party, etc.) and must not poison local detection.
 * Mixing the two caused the production engine to be reported as "local".
 */
function getLocalEngineBase() {
    if (typeof window === "undefined") return "http://localhost:5000";
    return `${window.location.protocol}//${window.location.hostname}:5000`;
}

/**
 * Fetch the list of available seeders from a local engine.
 * Returns null if no local engine is detected (timeout after 500ms).
 *
 * The engine guarantees manifest IDs are already in kebab-case (the seeder's
 * exported `name` field is the canonical plugin ID). No client-side translation
 * is needed — what the engine reports is what the frontend uses.
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

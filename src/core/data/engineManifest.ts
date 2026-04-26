// src/core/data/engineManifest.ts
// Fetches /manifest from a local data engine to discover available seeders.
// Used by resolveEngineUrl for per-plugin local vs cloud routing.

let localManifest: string[] | null = null;
let manifestFetched = false;

const LOCAL_ENGINE_BASE = "http://localhost:5001";

/**
 * Fetch the list of available seeders from a local engine.
 * Returns null if no local engine is detected (timeout after 2s).
 */
export async function fetchLocalEngineManifest(): Promise<string[] | null> {
  if (manifestFetched) return localManifest;
  manifestFetched = true;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${LOCAL_ENGINE_BASE}/manifest`, {
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

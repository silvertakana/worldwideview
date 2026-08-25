// src/core/data/engineManifest.ts
// Fetches /manifest from a local data engine to discover available seeders.
// Used by resolveEngineUrl for per-plugin local vs cloud routing.

/** Abort timeout for a single manifest-discovery attempt (ms); env-overridable. */
export const ENGINE_DISCOVERY_TIMEOUT_MS = Number(process.env.WWV_ENGINE_DISCOVERY_TIMEOUT_MS) || 2000;
/** How long a failed discovery suppresses re-fetching (ms). Failures are NOT cached permanently. */
export const ENGINE_DISCOVERY_RETRY_MS = 30_000;

let localManifest: string[] | null = null;
let manifestFetched = false;
let lastFailureAt = 0;

/**
 * Resolve the base URL of the local data engine.
 *
 * Always checks the local engine at localhost on NEXT_PUBLIC_WWV_LOCAL_ENGINE_PORT
 * (default 5000 — the port docker-compose.yml binds for wwv-data-engine).
 * NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL is intentionally
 * NOT used here: that variable belongs to each plugin's own declared engine
 * URL (production, third-party, etc.) and must not poison local detection.
 * Mixing the two caused the production engine to be reported as "local".
 */
function getLocalEngineBase() {
    const port = process.env.NEXT_PUBLIC_WWV_LOCAL_ENGINE_PORT || '5000';
    if (typeof window === "undefined") return `http://localhost:${port}`;
    return `${window.location.protocol}//${window.location.hostname}:${port}`;
}

/**
 * Fetch the list of available seeders from a local engine.
 * Returns null when no local engine is detected (request failure or an abort
 * after ENGINE_DISCOVERY_TIMEOUT_MS).
 *
 * The engine guarantees manifest IDs are already in kebab-case (the seeder's
 * exported `name` field is the canonical plugin ID). No client-side translation
 * is needed — what the engine reports is what the frontend uses.
 *
 * Caching model: a SUCCESSFUL discovery is cached indefinitely, but a FAILED
 * one is not — it backs off for ENGINE_DISCOVERY_RETRY_MS (30s) and the next
 * call after that window tries discovery again. Previously the first 500ms
 * timeout was cached as "no local engine" forever (until resetManifestCache()),
 * permanently misrouting every plugin to the cloud engine.
 */
export async function fetchLocalEngineManifest(): Promise<string[] | null> {
  if (manifestFetched) return localManifest;
  // Backoff: serve the previous failure from memory (no network cost) only
  // until the retry window elapses, then attempt discovery again.
  if (lastFailureAt > 0 && Date.now() - lastFailureAt < ENGINE_DISCOVERY_RETRY_MS) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ENGINE_DISCOVERY_TIMEOUT_MS);

    const res = await fetch(`${getLocalEngineBase()}/manifest`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      lastFailureAt = Date.now();
      return null;
    }

    const data = await res.json();
    localManifest = data.plugins || [];
    manifestFetched = true;
    console.log(
      `[EngineManifest] Local engine detected: ${localManifest.length} seeders`,
      localManifest
    );
    return localManifest;
  } catch {
    lastFailureAt = Date.now();
    console.log("[EngineManifest] No local engine detected, using cloud.");
    return null;
  }
}

/** Check if the local engine has a seeder for a given plugin ID. */
export function localEngineHasPlugin(pluginId: string): boolean {
  if (!localManifest) return false;
  return localManifest.includes(pluginId);
}

/**
 * Check if a plugin is blocklisted from using the local engine.
 *
 * Reads NEXT_PUBLIC_WWV_LOCAL_ENGINE_BLOCKLIST — a comma-separated list of
 * plugin IDs that should always use the cloud engine instead. This lets
 * operators bypass seeders that are registered but non-functional (e.g.,
 * missing API keys) without code changes.
 */
export function isPluginBlocklisted(pluginId: string): boolean {
  const blocklist = process.env.NEXT_PUBLIC_WWV_LOCAL_ENGINE_BLOCKLIST || "";
  if (!blocklist) return false;
  return blocklist.split(",").map((s) => s.trim()).includes(pluginId);
}

/** Reset the cache (for testing or reconnection). */
export function resetManifestCache(): void {
  localManifest = null;
  manifestFetched = false;
  lastFailureAt = 0;
}
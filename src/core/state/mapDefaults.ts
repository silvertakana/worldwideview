/**
 * @file mapDefaults.ts
 * @description Pure helpers for resolving default map configuration.
 */

/**
 * Resolves the default base layer ID.
 *
 * A stored user preference always wins. Otherwise Google Photorealistic 3D is
 * only offered as the default when a browser-side Google Maps API key of at
 * least 20 characters exists: keyless builds must never default to a layer
 * that cannot load, so they resolve to "bing-aerial".
 */
export function resolveDefaultBaseLayerId(stored: string | null, envKey: string | undefined): string {
    if (stored !== null) {
        return stored;
    }
    return envKey && envKey.length >= 20 ? "google-3d" : "bing-aerial";
}
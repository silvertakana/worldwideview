/**
 * Construct a jsdelivr CDN URL for a plugin's ESM bundle.
 * @param npmPackage npm package name (e.g. "wwv-plugin-earthquakes" or "@scope/name")
 * @param version semver version (e.g. "1.0.0")
 */
export function buildCdnUrl(npmPackage: string, version: string): string {
    return `https://cdn.jsdelivr.net/npm/${npmPackage}@${version}/dist/index.mjs`;
}

/** Check if an entry string is a remote URL (CDN-hosted bundle). */
export function isRemoteEntry(entry: string): boolean {
    return entry.startsWith("https://") || entry.startsWith("http://");
}

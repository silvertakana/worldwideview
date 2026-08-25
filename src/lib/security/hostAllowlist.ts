/**
 * @file hostAllowlist.ts
 * @description Host allowlist matching for URLs that gate server-side fetches
 * (camera extractor, stream proxy). Pure client-safe module: no Node builtins.
 * @module src/lib/security
 */

const WEB_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Returns true when the parsed hostname of `urlStr` exactly equals one of
 * `allowedDomains` or is a subdomain of one (suffix match on the hostname
 * component only, never a raw substring over the whole URL string, so
 * arbitrary hosts cannot precede or follow an allowed domain in the URL).
 *
 * Userinfo (`user:pass@`) is ignored automatically because `URL.hostname`
 * never includes it. Unparseable strings and non-web protocols (file:,
 * ftp:, javascript:, data:, ...) are rejected. Schemeless strings are
 * resolved against https:// before matching so plain host inputs still work.
 */
export function isHostAllowlisted(urlStr: string, allowedDomains: readonly string[]): boolean {
    if (!urlStr) return false;
    const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(urlStr) ? urlStr : `https://${urlStr}`;

    let url: URL;
    try {
        url = new URL(withScheme);
    } catch {
        return false;
    }

    if (!WEB_PROTOCOLS.has(url.protocol)) return false;

    const hostname = url.hostname.toLowerCase();
    return allowedDomains.some((domain) => {
        const d = domain.toLowerCase();
        return hostname === d || hostname.endsWith(`.${d}`);
    });
}
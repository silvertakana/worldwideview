/**
 * SmartFetcher 
 * Encapsulates a robust, tiered fetching strategy to bypass CORS and handle large payloads.
 * 
 * Strategy:
 * 1. Direct fetch (Browser GET)
 * 2. Public Proxy check (Browser HEAD via corsproxy)
 *    -> If < 1MB, Public Proxy GET
 *    -> If > 1MB or check fails, Local Server Proxy GET
 */


export class SmartFetcher {
    /**
     * Attempts to fetch JSON data from a cross-origin URL.
     * Strategy:
     * 1. Direct fetch (Browser GET)
     * 2. Local Server Proxy (Last resort, handles CORS or large payloads)
     */
    static async fetchJson(url: string): Promise<any> {
        // Step 1: Try Direct Fetch (Fastest)
        try {
            const res = await fetch(url);
            if (res.ok) {
                return await this.parseResponse(res);
            }
        } catch (e) {
            // Direct fetch failed (likely CORS). Fall through to Local Server Proxy.
        }

        // Step 2: Local Server Proxy
        const localProxyUrl = `/api/camera/proxy?url=${encodeURIComponent(url)}`;
        const localRes = await fetch(localProxyUrl);
        if (!localRes.ok) {
            throw new Error(`[SmartFetcher] Local proxy failed to load URL: ${url} (Status: ${localRes.status})`);
        }

        return await localRes.json();
    }

    private static async parseResponse(res: Response): Promise<any> {
        // Read as text to support both direct JSON HTTP responses and file download streams
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            throw new Error("Target URL did not return a valid JSON format.");
        }
    }
}

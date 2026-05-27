/**
 * Shared CORS proxy utility for browser-side plugin fetches.
 * Tries a chain of public CORS proxies in sequence.
 */

const CORS_PROXIES = [
    (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

/**
 * Fetch a URL via CORS proxy chain, trying each proxy in order.
 * Returns the first successful response, or throws if all fail.
 */
export async function fetchViaProxy(url: string, init?: RequestInit): Promise<Response> {
    for (const proxy of CORS_PROXIES) {
        try {
            const res = await fetch(proxy(url), {
                signal: AbortSignal.timeout(9000),
                ...init,
            });
            if (res.ok) return res;
        } catch {
            // try next proxy
        }
    }
    throw new Error(`All CORS proxies failed for: ${url}`);
}

/**
 * Fetch JSON via CORS proxy chain.
 */
export async function fetchJsonViaProxy<T = unknown>(url: string): Promise<T> {
    const res = await fetchViaProxy(url);
    return res.json() as Promise<T>;
}

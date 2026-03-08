/**
 * User API Keys — localStorage-backed key management.
 * Keys are stored per-browser and sent as custom headers so the server
 * can use them instead of its own .env defaults.
 */

export interface ApiKeyEntry {
    service: string;
    label: string;
    localStorageKey: string;
    headerName: string;
    placeholder: string;
}

/** All user-configurable API keys the platform supports. */
export const API_KEY_REGISTRY: ApiKeyEntry[] = [
    {
        service: "google_maps",
        label: "Google Maps API Key",
        localStorageKey: "wwv_key_google_maps",
        headerName: "X-User-Google-Key",
        placeholder: "AIza...",
    },
    {
        service: "nasa_firms",
        label: "NASA FIRMS API Key",
        localStorageKey: "wwv_key_nasa_firms",
        headerName: "X-User-Firms-Key",
        placeholder: "Enter your FIRMS MAP_KEY",
    },
];

/** Read a single key from localStorage. */
export function getUserApiKey(service: string): string {
    if (typeof window === "undefined") return "";
    const entry = API_KEY_REGISTRY.find((e) => e.service === service);
    if (!entry) return "";
    return localStorage.getItem(entry.localStorageKey) ?? "";
}

/** Write a single key to localStorage. */
export function setUserApiKey(service: string, value: string): void {
    const entry = API_KEY_REGISTRY.find((e) => e.service === service);
    if (!entry) return;
    if (value) {
        localStorage.setItem(entry.localStorageKey, value);
    } else {
        localStorage.removeItem(entry.localStorageKey);
    }
}

/** Remove all stored user keys. */
export function clearAllUserApiKeys(): void {
    API_KEY_REGISTRY.forEach((e) => localStorage.removeItem(e.localStorageKey));
}

/**
 * Build a headers object containing all set user API keys.
 * Spread this into your `fetch()` options: `{ headers: { ...buildUserKeyHeaders() } }`
 */
export function buildUserKeyHeaders(): Record<string, string> {
    if (typeof window === "undefined") return {};
    const headers: Record<string, string> = {};
    for (const entry of API_KEY_REGISTRY) {
        const value = localStorage.getItem(entry.localStorageKey);
        if (value) {
            headers[entry.headerName] = value;
        }
    }
    return headers;
}

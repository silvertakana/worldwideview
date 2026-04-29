import type { GeoEntity } from "@/core/plugins/PluginTypes";

interface CacheEntry {
    entities: GeoEntity[];
    timestamp: number;
    ttl: number;
}

/**
 * Two-tier cache: fast in-memory Map + persistent IndexedDB.
 * TTL-based expiry per data source.
 */
class CacheLayer {
    private memoryCache: Map<string, CacheEntry> = new Map();
    private dbName = "worldwideview-cache";
    private storeName = "entities";
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        if (typeof window === "undefined") return;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            request.onerror = () => {
                console.warn("[CacheLayer] IndexedDB unavailable, using memory only");
                resolve();
            };
        });
    }

    set(pluginId: string, entities: GeoEntity[], ttlMs: number = 30000): void {
        const entry: CacheEntry = {
            entities,
            timestamp: Date.now(),
            ttl: ttlMs,
        };
        this.memoryCache.set(pluginId, entry);

        // Persist to IndexedDB
        if (this.db) {
            try {
                const tx = this.db.transaction(this.storeName, "readwrite");
                tx.objectStore(this.storeName).put(entry, pluginId);
            } catch {
                // IndexedDB write failed, memory cache still works
            }
        }
    }

    get(pluginId: string): GeoEntity[] | null {
        const entry = this.memoryCache.get(pluginId);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.memoryCache.delete(pluginId);
            return null;
        }
        return entry.entities;
    }

    async getFromPersistent(pluginId: string): Promise<GeoEntity[] | null> {
        if (!this.db || !pluginId) return null;
        return new Promise((resolve) => {
            const tx = this.db!.transaction(this.storeName, "readonly");
            const request = tx.objectStore(this.storeName).get(pluginId);
            request.onsuccess = () => {
                const entry = request.result as CacheEntry | undefined;
                if (!entry || Date.now() - entry.timestamp > entry.ttl) {
                    resolve(null);
                } else {
                    // Populate memory cache
                    this.memoryCache.set(pluginId, entry);
                    resolve(entry.entities);
                }
            };
            request.onerror = () => resolve(null);
        });
    }

    invalidate(pluginId: string): void {
        this.memoryCache.delete(pluginId);
        if (this.db) {
            try {
                const tx = this.db.transaction(this.storeName, "readwrite");
                tx.objectStore(this.storeName).delete(pluginId);
            } catch {
                // Ignore
            }
        }
    }

    clear(): void {
        this.memoryCache.clear();
        if (this.db) {
            try {
                const tx = this.db.transaction(this.storeName, "readwrite");
                tx.objectStore(this.storeName).clear();
            } catch {
                // Ignore
            }
        }
    }
}

export const cacheLayer = new CacheLayer();

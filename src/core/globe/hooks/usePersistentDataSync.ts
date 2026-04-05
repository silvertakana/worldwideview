import { useEffect } from "react";
import { useStore } from "@/core/state/store";
import { isDemo } from "@/core/edition";

export function usePersistentDataSync() {
    const updateMapConfig = useStore((s) => s.updateMapConfig);
    const initFavorites = useStore((s) => s.initFavorites);

    // Load graphics settings from cookie on mount
    useEffect(() => {
        try {
            const match = document.cookie.match(/(^| )wwv_graphics=([^;]+)/);
            if (match) {
                const saved = JSON.parse(decodeURIComponent(match[2]));
                updateMapConfig(saved);
            }
        } catch (e) {
            console.warn("[GlobeView] Failed to load graphics settings from cookie", e);
        }
    }, [updateMapConfig]);

    // Initialize favorites from cookie or API
    useEffect(() => {
        if (isDemo) {
            try {
                const match = document.cookie.match(/(^| )wwv_favorites=([^;]+)/);
                if (match) {
                    const saved = JSON.parse(decodeURIComponent(match[2]));
                    initFavorites(saved);
                }
            } catch (e) {
                console.warn("[GlobeView] Failed to load favorites from cookie", e);
            }
        } else {
            fetch("/api/user/favorites")
                .then(res => {
                    if (res.status === 401) return []; // Unauthenticated, safe to ignore
                    if (res.ok) return res.json();
                    throw new Error("Failed to load favorites");
                })
                .then(data => {
                    if (Array.isArray(data)) {
                        const mappedFavorites = data.map((item: any) => ({
                            id: item.entityId, // Restore entity property matching
                            pluginId: item.pluginId,
                            label: item.label,
                            pluginName: item.pluginName,
                            lastSeen: new Date(item.lastSeen).getTime()
                        }));
                        initFavorites(mappedFavorites);
                    }
                })
                .catch(err => console.error("[GlobeView] Favorites fetch error:", err));
        }
    }, [initFavorites]);
}

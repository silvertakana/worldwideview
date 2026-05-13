/**
 * @file favoritesSlice.ts
 * @description State slice for managing user-bookmarked entities. 
 * Supports cross-session persistence via Cookies (demo mode) or PostgreSQL (local/cloud editions).
 */

import type { StateCreator } from "zustand";
import type { AppStore } from "./store";
import type { GeoEntity } from "@/core/plugins/PluginTypes";
import { isDemo } from "@/core/edition";

/**
 * A bookmarked entity with metadata for quick retrieval.
 */
export interface FavoriteItem {
    /** Unique ID of the bookmarked entity. */
    id: string;
    /** ID of the plugin that owns this entity. */
    pluginId: string;
    /** Human-readable label for the favorite. */
    label: string;
    /** Display name of the plugin for UI purposes. */
    pluginName: string;
    /** Optional React icon element (not persisted to DB/Cookie). */
    icon?: any;
    /** Timestamp of when the bookmark was created or last updated. */
    lastSeen: number;
}

/**
 * Zustand state slice for managing user favorites.
 */
export interface FavoritesSlice {
    /** List of all bookmarked items. */
    favorites: FavoriteItem[];
    /** Adds a new entity to the favorites list and persists it to the backend/cookie. */
    addFavorite: (entity: GeoEntity, pluginName: string, icon?: any) => void;
    /** Removes an entity from favorites and updates the persistence layer. */
    removeFavorite: (id: string) => void;
    /** Replaces the entire favorites list (typically called during initial app hydration). */
    initFavorites: (favorites: FavoriteItem[]) => void;
}

function syncFavoritesCookie(favorites: FavoriteItem[]) {
    if (typeof document !== "undefined") {
        // Omit icon (unserializable React element) during JSON stringify
        const toSave = favorites.map(f => ({ ...f, icon: undefined }));
        document.cookie = `wwv_favorites=${encodeURIComponent(JSON.stringify(toSave))}; path=/; max-age=31536000`; // 1 year
    }
}

export const createFavoritesSlice: StateCreator<AppStore, [], [], FavoritesSlice> = (set, get) => ({
    favorites: [],
    
    initFavorites: (favorites) => set({ favorites }),
    
    addFavorite: (entity, pluginName, icon) => {
        const state = get();
        if (state.favorites.some((f) => f.id === entity.id)) return;

        const newItem: FavoriteItem = {
            id: entity.id,
            pluginId: entity.pluginId,
            label: entity.label || entity.id,
            pluginName,
            icon,
            lastSeen: Date.now(),
        };

        const newFavorites = [...state.favorites, newItem];
        set({ favorites: newFavorites });

        // Trigger side-effects based on environment
        if (isDemo) {
            syncFavoritesCookie(newFavorites);
        } else {
            fetch("/api/user/favorites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    entityId: entity.id,
                    pluginId: entity.pluginId,
                    label: entity.label || entity.id,
                    pluginName
                })
            }).catch(e => console.error("Failed to sync add favorite to DB:", e));
        }
    },
    
    removeFavorite: (id) => {
        const state = get();
        const newFavorites = state.favorites.filter((f) => f.id !== id);
        set({ favorites: newFavorites });

        if (isDemo) {
            syncFavoritesCookie(newFavorites);
        } else {
            fetch(`/api/user/favorites?entityId=${encodeURIComponent(id)}`, {
                method: "DELETE"
            }).catch(e => console.error("Failed to sync remove favorite from DB:", e));
        }
    },
});

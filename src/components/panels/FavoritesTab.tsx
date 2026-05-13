/**
 * @file FavoritesTab.tsx
 * @description Tab panel for managing user-saved "favorite" map entities.
 * Categorizes favorites into accessible (layer enabled) and inaccessible (layer disabled).
 * @module src/components/panels
 */

import { useStore } from "@/core/state/store";
import { Trash2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

/**
 * @component FavoritesTab
 * @description Displays a list of entities the user has starred.
 * Provides quick selection and removal capabilities.
 */
export function FavoritesTab() {
    const favorites = useStore((s) => s.favorites);
    const removeFavorite = useStore((s) => s.removeFavorite);
    const entitiesByPlugin = useStore((s) => s.entitiesByPlugin);
    const layers = useStore((s) => s.layers);
    const setSelectedEntity = useStore((s) => s.setSelectedEntity);

    // Group favorites into Accessible and Inaccessible
    const accessible: typeof favorites = [];
    const inaccessible: typeof favorites = [];

    favorites.forEach((fav) => {
        const isLayerEnabled = layers[fav.pluginId]?.enabled;
        const entityList = entitiesByPlugin[fav.pluginId] || [];
        const entity = entityList.find((e) => e.id === fav.id);

        if (isLayerEnabled && entity) {
            accessible.push(fav);
        } else {
            inaccessible.push(fav);
        }
    });

    const handleSelect = (fav: typeof favorites[0]) => {
        const entityList = entitiesByPlugin[fav.pluginId] || [];
        const entity = entityList.find((e) => e.id === fav.id);
        if (entity) {
            setSelectedEntity(entity);
            trackEvent("favorite-select", { plugin: fav.pluginId });
        }
    };

    return (
        <div className="favorites-tab">
            {favorites.length === 0 && (
                <div style={{ padding: "var(--space-md)", color: "var(--text-muted)", fontSize: 13, fontStyle: "italic", textAlign: "center" }}>
                    No favorite items yet. Select an entity and click the star icon to add it here.
                </div>
            )}

            {accessible.length > 0 && (
                <div style={{ marginBottom: "var(--space-lg)" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "var(--space-sm)", paddingLeft: "var(--space-md)" }}>
                        Accessible
                    </div>
                    {accessible.map((fav) => (
                        <div key={fav.id} className="layer-item" onClick={() => handleSelect(fav)}>
                            <span className="layer-item__icon">
                                {typeof fav.icon === "string" ? fav.icon : fav.icon ? <fav.icon size={18} /> : null}
                            </span>
                            <div className="layer-item__info">
                                <div className="layer-item__name">{fav.label}</div>
                                <div className="layer-item__desc">{fav.pluginName}</div>
                            </div>
                            <button
                                className="intel-panel__close"
                                style={{ position: "relative", top: 0, right: 0, width: 28, height: 28 }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeFavorite(fav.id);
                                    trackEvent("favorite-remove", { plugin: fav.pluginId });
                                }}
                                title="Remove from favorites"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {inaccessible.length > 0 && (
                <div style={{ marginBottom: "var(--space-lg)" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent-red)", marginBottom: "var(--space-sm)", paddingLeft: "var(--space-md)" }}>
                        Inaccessible
                    </div>
                    {inaccessible.map((fav) => (
                        <div key={fav.id} className="layer-item" style={{ opacity: 0.6, cursor: "default" }}>
                            <span className="layer-item__icon" style={{ filter: "grayscale(100%)" }}>
                                {typeof fav.icon === "string" ? fav.icon : fav.icon ? <fav.icon size={18} /> : null}
                            </span>
                            <div className="layer-item__info">
                                <div className="layer-item__name" style={{ textDecoration: "line-through" }}>{fav.label}</div>
                                <div className="layer-item__desc">{fav.pluginName} (Layer Disabled or Item Lost)</div>
                            </div>
                            <button
                                className="intel-panel__close"
                                style={{ position: "relative", top: 0, right: 0, width: 28, height: 28 }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeFavorite(fav.id);
                                }}
                                title="Remove from favorites"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

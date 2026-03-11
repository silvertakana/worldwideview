"use client";

import { Trash2 } from "lucide-react";
import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import { pluginRegistry } from "@/core/plugins/PluginRegistry";

export function ImportedLayerList() {
    const layers = useStore((s) => s.importedLayers);
    const removeLayer = useStore((s) => s.removeImportedLayer);

    const handleDelete = (layerId: string) => {
        // Disable and unregister the dynamically created plugin
        pluginManager.disablePlugin(layerId);
        useStore.getState().setLayerEnabled(layerId, false);
        useStore.getState().clearEntities(layerId);
        pluginRegistry.unregister(layerId);
        removeLayer(layerId);
    };

    if (layers.length === 0) {
        return (
            <div className="geojson-empty">
                No imported layers yet. Click &quot;Import GeoJSON&quot; to add
                one.
            </div>
        );
    }

    return (
        <div className="geojson-layer-list">
            {layers.map((layer) => (
                <div key={layer.id} className="geojson-layer-item">
                    <span
                        className="geojson-layer-item__color"
                        style={{ backgroundColor: layer.color }}
                    />
                    <div className="geojson-layer-item__info">
                        <div className="geojson-layer-item__name">
                            {layer.name}
                        </div>
                        <div className="geojson-layer-item__count">
                            {layer.featureCollection.features.length} features
                        </div>
                    </div>
                    <button
                        className="geojson-layer-item__btn geojson-layer-item__btn--danger"
                        onClick={() => handleDelete(layer.id)}
                        aria-label="Delete"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            ))}
        </div>
    );
}

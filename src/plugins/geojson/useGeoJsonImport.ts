import { useState, useCallback, useRef, type DragEvent } from "react";
import { normalizeToGeoJson, type NormalizeResult, type ConvertOptions } from "@/lib/geojson";
import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import { pluginRegistry } from "@/core/plugins/PluginRegistry";
import { createGeoJsonPlugin, pickLayerColor } from "./GeoJsonImporterPlugin";
import { trackEvent } from "@/lib/analytics";
import type { ImportMethod } from "./types";

export function useGeoJsonImport(onClose: () => void) {
    const [method, setMethod] = useState<ImportMethod>("file");
    const [textInput, setTextInput] = useState("");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [color, setColor] = useState(() =>
        pickLayerColor(useStore.getState().importedLayers.length),
    );
    const [preview, setPreview] = useState<NormalizeResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const addLayer = useStore((s) => s.addImportedLayer);
    const initLayer = useStore((s) => s.initLayer);

    const processInput = useCallback(
        (raw: string, options?: ConvertOptions) => {
            setError(null);
            setPreview(null);
            try {
                const result = normalizeToGeoJson(raw, options);
                setPreview(result);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Unknown error");
            }
        },
        [],
    );

    const handleFile = useCallback(
        (file: File) => {
            setName(file.name.replace(/\.(geo)?json$/i, ""));
            const reader = new FileReader();
            reader.onload = () => processInput(reader.result as string);
            reader.onerror = () => setError("Failed to read file.");
            reader.readAsText(file);
        },
        [processInput],
    );

    const handleDrop = useCallback(
        (e: DragEvent) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
        },
        [handleFile],
    );

    const handleConfirm = async () => {
        if (!preview) return;
        const layerName = name.trim() || "Untitled Layer";
        const layerId = `geojson-${Date.now()}`;

        // 1. Store metadata
        addLayer({
            id: layerId,
            name: layerName,
            description: description.trim(),
            color,
            visible: true,
            featureCollection: preview.collection,
        });

        // 2. Register dynamic plugin
        const plugin = createGeoJsonPlugin({
            id: layerId,
            name: layerName,
            description: description.trim() || `Imported GeoJSON (${preview.collection.features.length} features)`,
            color,
            featureCollection: preview.collection,
        });

        pluginRegistry.register(plugin);
        await pluginManager.registerPlugin(plugin);
        initLayer(plugin.id);

        // 3. Auto-enable
        pluginManager.enablePlugin(plugin.id);
        useStore.getState().setLayerEnabled(plugin.id, true);

        trackEvent("geojson-import", { featureCount: preview.collection.features.length });
        onClose();
    };

    return {
        method, setMethod,
        textInput, setTextInput,
        name, setName,
        description, setDescription,
        color, setColor,
        preview, setPreview,
        error, setError,
        dragging, setDragging,
        fileRef,
        processInput, handleFile, handleDrop, handleConfirm
    };
}

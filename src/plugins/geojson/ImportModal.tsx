"use client";

import { useState, useCallback, useRef, type DragEvent } from "react";
import { Upload, ClipboardPaste, FileJson, X } from "lucide-react";
import { normalizeToGeoJson } from "@/lib/geojson";
import type { NormalizeResult } from "@/lib/geojson";
import type { ConvertOptions } from "@/lib/geojson";
import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import { pluginRegistry } from "@/core/plugins/PluginRegistry";
import { createGeoJsonPlugin, pickLayerColor } from "./GeoJsonImporterPlugin";

type ImportMethod = "file" | "paste" | "custom";

interface ImportModalProps {
    onClose: () => void;
}

export function ImportModal({ onClose }: ImportModalProps) {
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

        // 1. Store metadata in the geojson slice
        addLayer({
            id: layerId,
            name: layerName,
            description: description.trim(),
            color,
            visible: true,
            featureCollection: preview.collection,
        });

        // 2. Create and register a dynamic plugin
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

        // 3. Auto-enable the layer
        pluginManager.enablePlugin(plugin.id);
        useStore.getState().setLayerEnabled(plugin.id, true);

        onClose();
    };

    return (
        <div className="geojson-modal-overlay" onClick={onClose}>
            <div
                className="geojson-modal glass-panel"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="geojson-modal__header">
                    <h3>Import GeoJSON</h3>
                    <button
                        className="geojson-modal__close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <MethodTabs method={method} onChange={(m) => {
                    setMethod(m);
                    setPreview(null);
                    setError(null);
                }} />

                <div className="geojson-modal__body">
                    {method === "file" && (
                        <FileDropZone
                            dragging={dragging}
                            fileRef={fileRef}
                            onDrop={handleDrop}
                            onDragOver={() => setDragging(true)}
                            onDragLeave={() => setDragging(false)}
                            onFileSelect={handleFile}
                        />
                    )}

                    {(method === "paste" || method === "custom") && (
                        <TextInputArea
                            method={method}
                            value={textInput}
                            onChange={setTextInput}
                            onParse={() => processInput(textInput)}
                        />
                    )}

                    {error && <div className="geojson-error">{error}</div>}

                    {preview && (
                        <PreviewInfo preview={preview} />
                    )}

                    {preview && (
                        <MetadataForm
                            name={name}
                            description={description}
                            color={color}
                            onNameChange={setName}
                            onDescriptionChange={setDescription}
                            onColorChange={setColor}
                        />
                    )}
                </div>

                <div className="geojson-modal__footer">
                    <button className="geojson-btn geojson-btn--secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="geojson-btn geojson-btn--primary"
                        disabled={!preview}
                        onClick={handleConfirm}
                    >
                        Import Layer
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Sub-components ──────────────────────────────────────── */

function MethodTabs({ method, onChange }: { method: ImportMethod; onChange: (m: ImportMethod) => void }) {
    const tabs: [ImportMethod, typeof Upload, string][] = [
        ["file", Upload, "File"],
        ["paste", ClipboardPaste, "Paste"],
        ["custom", FileJson, "Custom JSON"],
    ];
    return (
        <div className="geojson-modal__tabs">
            {tabs.map(([key, Icon, label]) => (
                <button
                    key={key}
                    className={`geojson-tab ${method === key ? "geojson-tab--active" : ""}`}
                    onClick={() => onChange(key)}
                >
                    <Icon size={14} />
                    {label}
                </button>
            ))}
        </div>
    );
}

function FileDropZone({ dragging, fileRef, onDrop, onDragOver, onDragLeave, onFileSelect }: {
    dragging: boolean;
    fileRef: React.RefObject<HTMLInputElement | null>;
    onDrop: (e: DragEvent) => void;
    onDragOver: () => void;
    onDragLeave: () => void;
    onFileSelect: (file: File) => void;
}) {
    return (
        <div
            className={`geojson-dropzone ${dragging ? "geojson-dropzone--active" : ""}`}
            onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
        >
            <Upload size={32} />
            <p>Drag & drop a .geojson or .json file</p>
            <p className="geojson-dropzone__sub">or click to browse</p>
            <input
                ref={fileRef}
                type="file"
                accept=".geojson,.json"
                hidden
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onFileSelect(file);
                }}
            />
        </div>
    );
}

function TextInputArea({ method, value, onChange, onParse }: {
    method: "paste" | "custom";
    value: string;
    onChange: (v: string) => void;
    onParse: () => void;
}) {
    return (
        <>
            <textarea
                className="geojson-textarea"
                placeholder={
                    method === "paste"
                        ? "Paste GeoJSON here..."
                        : "Paste custom JSON array (with lat/lon fields)..."
                }
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={8}
            />
            <button
                className="geojson-btn geojson-btn--secondary"
                onClick={onParse}
                disabled={!value.trim()}
            >
                Parse
            </button>
        </>
    );
}

function PreviewInfo({ preview }: { preview: NormalizeResult }) {
    return (
        <div className="geojson-preview">
            <div className="geojson-preview__stat">
                <strong>{preview.collection.features.length}</strong> features
            </div>
            <div className="geojson-preview__stat">
                Types: {preview.geometryTypes.join(", ")}
            </div>
            {preview.skippedCount > 0 && (
                <div className="geojson-preview__warn">
                    {preview.skippedCount} features skipped (invalid geometry)
                </div>
            )}
        </div>
    );
}

function MetadataForm({ name, description, color, onNameChange, onDescriptionChange, onColorChange }: {
    name: string; description: string; color: string;
    onNameChange: (v: string) => void;
    onDescriptionChange: (v: string) => void;
    onColorChange: (v: string) => void;
}) {
    return (
        <div className="geojson-meta">
            <input className="geojson-input" placeholder="Layer name" value={name} onChange={(e) => onNameChange(e.target.value)} />
            <input className="geojson-input" placeholder="Description (optional)" value={description} onChange={(e) => onDescriptionChange(e.target.value)} />
            <div className="geojson-color-row">
                <label>Color</label>
                <input type="color" value={color} onChange={(e) => onColorChange(e.target.value)} />
            </div>
        </div>
    );
}

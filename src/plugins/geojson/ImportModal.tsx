"use client";

import { X } from "lucide-react";
import { useGeoJsonImport } from "./useGeoJsonImport";
import { MethodTabs } from "./components/MethodTabs";
import { FileDropZone } from "./components/FileDropZone";
import { TextInputArea } from "./components/TextInputArea";
import { PreviewInfo } from "./components/PreviewInfo";
import { MetadataForm } from "./components/MetadataForm";

interface ImportModalProps {
    onClose: () => void;
}

export function ImportModal({ onClose }: ImportModalProps) {
    const {
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
    } = useGeoJsonImport(onClose);

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

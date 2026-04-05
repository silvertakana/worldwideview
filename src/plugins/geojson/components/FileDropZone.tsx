import { Upload } from "lucide-react";
import type { DragEvent, RefObject } from "react";

export function FileDropZone({ dragging, fileRef, onDrop, onDragOver, onDragLeave, onFileSelect }: {
    dragging: boolean;
    fileRef: RefObject<HTMLInputElement | null>;
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

import type { NormalizeResult } from "@/lib/geojson";

export function PreviewInfo({ preview }: { preview: NormalizeResult }) {
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

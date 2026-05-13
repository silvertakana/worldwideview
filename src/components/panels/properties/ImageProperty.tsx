/**
 * @file ImageProperty.tsx
 * @description Specialized property renderer for image URLs. 
 * Supports inline preview and popout to a floating window.
 * @module src/components/panels/properties
 */

import React from 'react';
import { Maximize2 } from 'lucide-react';
import { useStore } from '../../../core/state/store';

/**
 * @interface ImagePropertyProps
 * @description Properties for the ImageProperty component.
 * @property {string} label - The display name for the image.
 * @property {string} imageUrl - The URL of the image to display.
 * @property {string} entityId - The ID of the parent entity.
 * @property {string} [entityLabel] - The display label of the parent entity.
 * @property {string} [classNamePrefix] - CSS class prefix for styling (defaults to "intel-panel").
 */
interface ImagePropertyProps {
    label: string;
    imageUrl: string;
    entityId: string;
    entityLabel?: string;
    classNamePrefix?: string;
}

export function ImageProperty({ label, imageUrl, entityId, entityLabel, classNamePrefix = "intel-panel" }: ImagePropertyProps) {
    const addFloatingStream = useStore((s) => s.addFloatingStream);

    return (
        <div style={{ marginTop: "var(--space-md)", paddingTop: "var(--space-sm)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <span className={`${classNamePrefix}__prop-key`} style={{ marginBottom: 8, display: "block" }}>
                {label}
            </span>
            <div style={{ position: "relative", borderRadius: "var(--radius-md)", overflow: "hidden", background: "rgba(0,0,0,0.2)", display: "flex", justifyContent: "center" }}>
                <img src={imageUrl} alt={label} style={{ width: "100%", maxHeight: "200px", objectFit: "cover", display: "block" }} />
                <button
                    className={`${classNamePrefix}__img-popout`}
                    onClick={() => addFloatingStream({
                        id: `image_${entityId}_${label.replace(/\s+/g, "_")}`,
                        streamUrl: imageUrl,
                        isIframe: false,
                        label: `${entityLabel || entityId} - ${label}`,
                        type: "image"
                    })}
                    title="Popout Image"
                >
                    <Maximize2 size={14} />
                </button>
            </div>
        </div>
    );
}

/**
 * @file LongTextProperty.tsx
 * @description Specialized property renderer for long text blocks (descriptions, summaries).
 * Uses a column layout and handles overflow/scrolling for large amounts of text.
 * @module src/components/panels/properties
 */

import React from 'react';
import { IntelPropertyRow } from './IntelPropertyRow';

/**
 * @interface LongTextPropertyProps
 * @description Properties for the LongTextProperty component.
 * @property {string} label - The display label for the text block.
 * @property {string} text - The long text content to display.
 * @property {string} [classNamePrefix] - CSS class prefix for styling (defaults to "intel-panel").
 */
interface LongTextPropertyProps {
    label: string;
    text: string;
    classNamePrefix?: string;
}

export function LongTextProperty({ label, text, classNamePrefix = "intel-panel" }: LongTextPropertyProps) {
    // If it's a known summary block, we might want it to have a specific height,
    // otherwise just let it be pre-wrap.
    const isSummary = label.toLowerCase() === "summary" || label.toLowerCase() === "description";

    return (
        <IntelPropertyRow label={label} isColumn={true} classNamePrefix={classNamePrefix}>
            <div 
                style={{ 
                    maxHeight: isSummary ? "150px" : "auto", 
                    width: "100%", 
                    overflowY: isSummary ? "auto" : "visible", 
                    whiteSpace: "pre-wrap", 
                    paddingRight: "var(--space-xs)", 
                    lineHeight: "1.4",
                    wordBreak: "break-word"
                }}
            >
                {text}
            </div>
        </IntelPropertyRow>
    );
}

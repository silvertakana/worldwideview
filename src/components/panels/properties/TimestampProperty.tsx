/**
 * @file TimestampProperty.tsx
 * @description Specialized property renderer for date/time values.
 * Allows users to toggle between local time and UTC.
 * @module src/components/panels/properties
 */

import React, { useState } from 'react';
import { IntelPropertyRow } from './IntelPropertyRow';

/**
 * @interface TimestampPropertyProps
 * @description Properties for the TimestampProperty component.
 * @property {string | number | Date} timestamp - The raw timestamp to display.
 * @property {string} [classNamePrefix] - CSS class prefix for styling (defaults to "intel-panel").
 */
interface TimestampPropertyProps {
    timestamp: string | number | Date;
    classNamePrefix?: string;
}

export function TimestampProperty({ timestamp, classNamePrefix = "intel-panel" }: TimestampPropertyProps) {
    const [showUtc, setShowUtc] = useState(false);
    return (
        <IntelPropertyRow label="Timestamp" isColumn={true} classNamePrefix={classNamePrefix}>
            <span 
                style={{ cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: "2px", width: "100%" }}
                onClick={() => setShowUtc(!showUtc)}
                title="Click to view UTC time"
            >
                {new Date(timestamp).toLocaleString(undefined, {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZoneName: 'short'
                })}
            </span>
            {showUtc && (
                <span style={{ fontSize: "0.85em", color: "var(--text-muted)", width: "100%" }}>
                    {new Date(timestamp).toUTCString()}
                </span>
            )}
        </IntelPropertyRow>
    );
}

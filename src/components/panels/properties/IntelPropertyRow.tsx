/**
 * @file IntelPropertyRow.tsx
 * @description Base layout component for displaying key-value property rows 
 * within entity information panels.
 * @module src/components/panels/properties
 */

import React from 'react';

/**
 * @interface IntelPropertyRowProps
 * @description Properties for the IntelPropertyRow component.
 * @property {string} label - The label for the property (the "key").
 * @property {boolean} [isColumn] - If true, renders the value below the label instead of beside it.
 * @property {string} [classNamePrefix] - CSS class prefix for styling (defaults to "intel-panel").
 * @property {React.ReactNode} children - The value content to display.
 */
interface IntelPropertyRowProps {
    label: string;
    isColumn?: boolean;
    classNamePrefix?: string;
    children: React.ReactNode;
}

export function IntelPropertyRow({
    label,
    isColumn,
    classNamePrefix = "intel-panel",
    children
}: IntelPropertyRowProps) {
    if (isColumn) {
        return (
            <div className={`${classNamePrefix}__prop`} style={{ flexDirection: "column", alignItems: "flex-start", gap: "var(--space-xs)" }}>
                <span className={`${classNamePrefix}__prop-key`}>{label}</span>
                <div className={`${classNamePrefix}__prop-value`} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px", width: "100%" }}>
                    {children}
                </div>
            </div>
        );
    }

    return (
        <div className={`${classNamePrefix}__prop`}>
            <span className={`${classNamePrefix}__prop-key`}>{label}</span>
            <span className={`${classNamePrefix}__prop-value`}>{children}</span>
        </div>
    );
}

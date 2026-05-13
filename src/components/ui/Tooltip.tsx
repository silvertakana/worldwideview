"use client";

/**
 * @file Tooltip.tsx
 * @description Lightweight accessibility-focused tooltip system.
 * Uses React Portals for overflow safety and features smart positioning 
 * with configurable delay and hover/focus triggers.
 * @module src/components/ui
 */

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
    children: React.ReactNode;
    content: React.ReactNode;
    delay?: number;
}

/**
 * @component Tooltip
 * @description Renders a floating content box near a target element on hover/focus.
 * 
 * @param {TooltipProps} props - Component properties.
 * @param {React.ReactNode} props.children - The trigger element.
 * @param {React.ReactNode} props.content - Content to display inside the tooltip.
 * @param {number} [props.delay=300] - Delay in ms before showing the tooltip.
 */
export function Tooltip({ children, content, delay = 300 }: TooltipProps) {
    const [visible, setVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const targetRef = useRef<HTMLSpanElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const showTooltip = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setVisible(true), delay);
    };

    const hideTooltip = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setVisible(false);
    };

    useEffect(() => {
        if (visible && targetRef.current) {
            const rect = targetRef.current.getBoundingClientRect();
            setCoords({
                top: rect.top - 6, // 6px above the element
                left: rect.left + rect.width / 2,
            });
        }
    }, [visible]);

    return (
        <span
            ref={targetRef}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
            onFocus={showTooltip}
            onBlur={hideTooltip}
            style={{ display: "inline-flex" }}
        >
            {children}
            {visible &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        style={{
                            position: "fixed",
                            top: coords.top,
                            left: coords.left,
                            transform: "translate(-50%, -100%)",
                            zIndex: 99999,
                            background: "var(--bg-primary)",
                            color: "var(--text-primary)",
                            fontSize: "11px",
                            fontWeight: 500,
                            padding: "4px 8px",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--border-subtle)",
                            whiteSpace: "nowrap",
                            pointerEvents: "none",
                            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                            animation: "tooltip-fade-in 0.15s ease-out",
                        }}
                    >
                        {content}
                        <style>{`
                            @keyframes tooltip-fade-in {
                                from { opacity: 0; transform: translate(-50%, -90%); }
                                to { opacity: 1; transform: translate(-50%, -100%); }
                            }
                        `}</style>
                    </div>,
                    document.body
                )}
        </span>
    );
}

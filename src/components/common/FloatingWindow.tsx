/**
 * @file FloatingWindow.tsx
 * @description A draggable and resizable modal window container.
 * Supports mouse and touch interactions, boundary constraints, and persistence callbacks.
 * @module src/components/common
 */

"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";

/**
 * Props for the FloatingWindow component.
 */
interface FloatingWindowProps {
    /** Unique identifier for the window instance. */
    id: string;
    /** Title text displayed in the header bar. */
    title: string;
    /** Inner content to be rendered within the window body. */
    children: React.ReactNode;
    /** Initial screen coordinates for the window. */
    initialPosition?: { x: number; y: number };
    /** Initial dimensions for the window. */
    initialSize?: { width: number; height: number };
    /** Callback triggered when the close button is clicked. */
    onClose: () => void;
    /** Callback triggered when the window is moved or resized. */
    onUpdate?: (updates: { position?: { x: number; y: number }; size?: { width: number; height: number } }) => void;
    /** Minimum allowed width during resize. Defaults to 300. */
    minWidth?: number;
    /** Minimum allowed height during resize. Defaults to 200. */
    minHeight?: number;
}

/**
 * @component FloatingWindow
 * @description A floating, interactive container used for data streams and secondary tools.
 * Implements a custom drag-and-resize engine compatible with both desktop and mobile.
 * 
 * @param {FloatingWindowProps} props - Component properties.
 */
export const FloatingWindow: React.FC<FloatingWindowProps> = ({
    id,
    title,
    children,
    initialPosition = { x: 100, y: 100 },
    initialSize = { width: 400, height: 300 },
    onClose,
    onUpdate,
    minWidth = 300,
    minHeight = 200,
}) => {
    const [pos, setPos] = useState(initialPosition);
    const [size, setSize] = useState(initialSize);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const posRef = useRef(pos);
    const sizeRef = useRef(size);
    const windowRef = useRef<HTMLDivElement>(null);

    // Keep refs in sync for use inside event callbacks
    useEffect(() => { posRef.current = pos; }, [pos]);
    useEffect(() => { sizeRef.current = size; }, [size]);

    // ── Mouse drag ────────────────────────────────────────────────────────────
    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest(".window-controls")) return;
        setIsDragging(true);
        dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    };

    const handleResizeMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging) {
            setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
        } else if (isResizing) {
            const deltaX = e.clientX - dragStart.current.x;
            const deltaY = e.clientY - dragStart.current.y;
            setSize(prev => ({
                width: Math.max(minWidth, prev.width + deltaX),
                height: Math.max(minHeight, prev.height + deltaY),
            }));
            dragStart.current = { x: e.clientX, y: e.clientY };
        }
    }, [isDragging, isResizing, minWidth, minHeight]);

    const handleMouseUp = useCallback(() => {
        if (isDragging || isResizing) {
            setIsDragging(false);
            setIsResizing(false);
            onUpdate?.({ position: posRef.current, size: sizeRef.current });
        }
    }, [isDragging, isResizing, onUpdate]);

    useEffect(() => {
        if (isDragging || isResizing) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
        } else {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        }
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

    // ── Touch drag ────────────────────────────────────────────────────────────
    const handleTouchStartDrag = (e: React.TouchEvent) => {
        if ((e.target as HTMLElement).closest(".window-controls")) return;
        const touch = e.touches[0];
        setIsDragging(true);
        dragStart.current = { x: touch.clientX - posRef.current.x, y: touch.clientY - posRef.current.y };
    };

    const handleTouchStartResize = (e: React.TouchEvent) => {
        e.stopPropagation();
        const touch = e.touches[0];
        setIsResizing(true);
        dragStart.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchMove = useCallback((e: TouchEvent) => {
        e.preventDefault(); // prevent page scroll while dragging
        const touch = e.touches[0];
        if (isDragging) {
            setPos({ x: touch.clientX - dragStart.current.x, y: touch.clientY - dragStart.current.y });
        } else if (isResizing) {
            const deltaX = touch.clientX - dragStart.current.x;
            const deltaY = touch.clientY - dragStart.current.y;
            setSize(prev => ({
                width: Math.max(minWidth, prev.width + deltaX),
                height: Math.max(minHeight, prev.height + deltaY),
            }));
            dragStart.current = { x: touch.clientX, y: touch.clientY };
        }
    }, [isDragging, isResizing, minWidth, minHeight]);

    const handleTouchEnd = useCallback(() => {
        if (isDragging || isResizing) {
            setIsDragging(false);
            setIsResizing(false);
            onUpdate?.({ position: posRef.current, size: sizeRef.current });
        }
    }, [isDragging, isResizing, onUpdate]);

    useEffect(() => {
        const opts = { passive: false } as AddEventListenerOptions;
        if (isDragging || isResizing) {
            window.addEventListener("touchmove", handleTouchMove, opts);
            window.addEventListener("touchend", handleTouchEnd);
        } else {
            window.removeEventListener("touchmove", handleTouchMove);
            window.removeEventListener("touchend", handleTouchEnd);
        }
        return () => {
            window.removeEventListener("touchmove", handleTouchMove);
            window.removeEventListener("touchend", handleTouchEnd);
        };
    }, [isDragging, isResizing, handleTouchMove, handleTouchEnd]);

    return (
        <div
            ref={windowRef}
            style={{
                position: "fixed",
                left: pos.x,
                top: pos.y,
                width: size.width,
                height: size.height,
                zIndex: 1000,
                display: "flex",
                flexDirection: "column",
                backgroundColor: "rgba(10, 10, 10, 0.85)",
                backdropFilter: "blur(12px)",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
                overflow: "hidden",
                color: "white",
                touchAction: "none", // prevent browser gestures on the window itself
            }}
        >
            {/* Header / Title Bar */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                    cursor: isDragging ? "grabbing" : "grab",
                    userSelect: "none",
                    touchAction: "none",
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStartDrag}
            >
                <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255, 255, 255, 0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {title}
                </span>

                <div className="window-controls" style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "none",
                            color: "rgba(255, 255, 255, 0.4)",
                            cursor: "pointer",
                            padding: "4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "4px",
                            transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = "#ef4444";
                            e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = "rgba(255, 255, 255, 0.4)";
                            e.currentTarget.style.backgroundColor = "transparent";
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                {children}
            </div>

            {/* Resize Handle */}
            <div
                style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: "24px",
                    height: "24px",
                    cursor: "nwse-resize",
                    zIndex: 1001,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "flex-end",
                    padding: "4px",
                    touchAction: "none",
                }}
                onMouseDown={handleResizeMouseDown}
                onTouchStart={handleTouchStartResize}
            >
                <div style={{ width: "6px", height: "6px", backgroundColor: "rgba(255, 255, 255, 0.3)", borderRadius: "1px" }} />
            </div>
        </div>
    );
};

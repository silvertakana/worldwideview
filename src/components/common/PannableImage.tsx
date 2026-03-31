"use client";

import React, { useState, useRef, useCallback } from "react";
import { RotateCcw } from "lucide-react";

interface PannableImageProps {
    src: string;
    alt: string;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.15;

export const PannableImage: React.FC<PannableImageProps> = ({ src, alt }) => {
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const panStart = useRef({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const clampPan = useCallback((x: number, y: number, z: number) => {
        if (z <= 1) return { x: 0, y: 0 };
        const limit = ((z - 1) / z) * 50;
        return {
            x: Math.max(-limit, Math.min(limit, x)),
            y: Math.max(-limit, Math.min(limit, y)),
        };
    }, []);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.stopPropagation();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setZoom((prev) => {
            const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta * prev));
            if (next <= 1) setPan({ x: 0, y: 0 });
            else setPan((p) => clampPan(p.x, p.y, next));
            return next;
        });
    }, [clampPan]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (zoom <= 1) return;
        e.preventDefault();
        setIsPanning(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        panStart.current = { ...pan };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [zoom, pan]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isPanning || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const dx = ((e.clientX - dragStart.current.x) / rect.width) * 100;
        const dy = ((e.clientY - dragStart.current.y) / rect.height) * 100;
        const newPan = clampPan(panStart.current.x + dx, panStart.current.y + dy, zoom);
        setPan(newPan);
    }, [isPanning, zoom, clampPan]);

    const handlePointerUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    const handleReset = useCallback(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, []);

    const isZoomed = zoom > 1.01;

    return (
        <div
            ref={containerRef}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
                width: "100%",
                height: "100%",
                overflow: "hidden",
                cursor: isZoomed ? (isPanning ? "grabbing" : "grab") : "default",
                touchAction: "none",
                position: "relative",
                userSelect: "none",
            }}
        >
            <img
                src={src}
                alt={alt}
                draggable={false}
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                    transform: `scale(${zoom}) translate(${pan.x}%, ${pan.y}%)`,
                    transformOrigin: "center center",
                    transition: isPanning ? "none" : "transform 0.15s ease-out",
                    pointerEvents: "none",
                }}
            />

            {/* Zoom level indicator */}
            {isZoomed && (
                <div style={{
                    position: "absolute",
                    bottom: 8,
                    left: 8,
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    color: "rgba(255,255,255,0.7)",
                    background: "rgba(0,0,0,0.5)",
                    backdropFilter: "blur(6px)",
                    padding: "2px 8px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    pointerEvents: "none",
                }}>
                    {zoom.toFixed(1)}×
                </div>
            )}

            {/* Reset button */}
            {isZoomed && (
                <button
                    onClick={handleReset}
                    title="Reset zoom"
                    style={{
                        position: "absolute",
                        bottom: 8,
                        right: 8,
                        width: 26,
                        height: 26,
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(0,0,0,0.5)",
                        backdropFilter: "blur(6px)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "rgba(255,255,255,0.7)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <RotateCcw size={12} />
                </button>
            )}
        </div>
    );
};

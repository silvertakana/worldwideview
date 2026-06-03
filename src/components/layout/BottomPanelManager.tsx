"use client";

import React, { useRef, useState, useEffect } from "react";
import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import { Timeline } from "@/components/timeline/Timeline";
import { PluginErrorBoundary } from "@/components/common/PluginErrorBoundary";

export function BottomPanelManager() {
    const activeBottomPanel = useStore((s) => s.activeBottomPanel);
    const setActiveBottomPanel = useStore((s) => s.setActiveBottomPanel);
    const bottomPanelHeight = useStore((s) => s.bottomPanelHeight);
    const setBottomPanelHeight = useStore((s) => s.setBottomPanelHeight);
    const layers = useStore((s) => s.layers);

    const [mountedPanel, setMountedPanel] = useState<string | null>(activeBottomPanel);

    const resizeRef = useRef<HTMLDivElement>(null);

    // Get all registered plugins that provide a bottom panel component
    const plugins = pluginManager.getAllPlugins().map((p) => p.plugin);
    const dockablePlugins = plugins.filter(
        (p) => p.getBottomPanelComponent !== undefined && layers[p.id]?.enabled
    );

    const isCoveredRef = useRef(false);

    useEffect(() => {
        if (activeBottomPanel) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setMountedPanel(activeBottomPanel);
        } else {
            // Keep the panel mounted for the duration of the CSS exit transition (400ms)
            const timer = setTimeout(() => {
                setMountedPanel(null);
            }, 400);
            return () => clearTimeout(timer);
        }
    }, [activeBottomPanel]);

    // Pointer-capture drag handlers — attached directly to the resize handle element.
    // Using setPointerCapture ensures pointermove/pointerup are delivered to the
    // element even when the pointer leaves it, which is required for webkit
    // (without capture, webkit drops synthetic pointermove events from Playwright
    // and from fast real-user drags that leave the element bounds).
    const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        document.body.classList.add("is-dragging-bottom-panel");
    };

    const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const newHeight = window.innerHeight - e.clientY;
        const clampedHeight = Math.max(120, Math.min(newHeight, window.innerHeight - 100));
        setBottomPanelHeight(clampedHeight);
    };

    const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        document.body.classList.remove("is-dragging-bottom-panel");
    };

    // Dynamically push sidebars up based on bottom panel height
    useEffect(() => {
        const threshold = 400; // Point where panel covers the sidebars
        const panelBottomOffset = 16; // Distance from screen bottom to panel bottom
        const gap = 16; // Desired gap between the top of the panel and the bottom of the sidebars
        
        if (activeBottomPanel) {
            const shouldBeCovered = bottomPanelHeight > threshold;

            if (shouldBeCovered !== isCoveredRef.current) {
                isCoveredRef.current = shouldBeCovered;
                document.body.classList.add("sidebar-force-transition");
                setTimeout(() => {
                    document.body.classList.remove("sidebar-force-transition");
                }, 400); // var(--duration-slow) is 400ms
            }

            if (!shouldBeCovered) {
                // Push sidebars up with gap
                document.documentElement.style.setProperty("--sidebar-bottom", `${bottomPanelHeight + panelBottomOffset + gap}px`);
            } else {
                // Drop sidebars back down to be covered
                document.documentElement.style.setProperty("--sidebar-bottom", `${panelBottomOffset}px`);
            }
        } else {
            // Panel closed
            if (isCoveredRef.current) {
                isCoveredRef.current = false;
                document.body.classList.add("sidebar-force-transition");
                setTimeout(() => {
                    document.body.classList.remove("sidebar-force-transition");
                }, 400);
            }
            document.documentElement.style.setProperty("--sidebar-bottom", `${panelBottomOffset}px`);
        }
    }, [activeBottomPanel, bottomPanelHeight]);

    // Handle mobile auto-close on load (legacy behavior from Timeline)
    useEffect(() => {
        if (window.innerWidth < 768 && activeBottomPanel !== null) {
            setActiveBottomPanel(null);
        }
    }, []);

    // Render active panel content
    const renderActivePanelContent = () => {
        if (!mountedPanel) return null;

        if (mountedPanel === "timeline") {
            return <Timeline />;
        }

        const managed = pluginManager.getPlugin(mountedPanel);
        if (managed && managed.plugin.getBottomPanelComponent) {
            const Comp = managed.plugin.getBottomPanelComponent();
            return (
                <PluginErrorBoundary pluginId={mountedPanel}>
                    <Comp 
                        pluginId={mountedPanel} 
                        enabled={activeBottomPanel === mountedPanel ? managed.enabled : false} 
                    />
                </PluginErrorBoundary>
            );
        }

        return null;
    };

    return (
        <div className="bottom-panel-system">
            {/* Dock: Always visible above the panel */}
            <div className={`bottom-panel-dock ${!activeBottomPanel ? "floating-pills" : ""}`}>
                <button
                    className={`dock-btn ${activeBottomPanel === "timeline" ? "active" : ""}`}
                    onClick={() => setActiveBottomPanel(activeBottomPanel === "timeline" ? null : "timeline")}
                    title="Timeline"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className="dock-btn-label">Timeline</span>
                </button>
                
                {dockablePlugins.map((plugin) => (
                    <button
                        key={plugin.id}
                        className={`dock-btn ${activeBottomPanel === plugin.id ? "active" : ""}`}
                        onClick={() => setActiveBottomPanel(activeBottomPanel === plugin.id ? null : plugin.id)}
                        title={plugin.name || plugin.id}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <path d="M3 9h18" />
                        </svg>
                        <span className="dock-btn-label">{plugin.name || plugin.id}</span>
                    </button>
                ))}
            </div>

            {/* Active Panel Shell */}
            <div 
                className={`bottom-panel glass-panel ${activeBottomPanel ? "open" : "closed"}`}
                style={{ height: activeBottomPanel ? `${bottomPanelHeight}px` : "0px" }}
            >
                {mountedPanel && (
                    <>
                        <div
                            className="bottom-panel-resize-handle"
                            data-testid="bottom-panel-resize-handle"
                            ref={resizeRef}
                            onPointerDown={handleResizePointerDown}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                            onPointerCancel={handleResizePointerUp}
                        >
                            <div className="resize-grip" />
                        </div>
                        <button 
                            className="bottom-panel-close-btn" 
                            onClick={() => setActiveBottomPanel(null)} 
                            title="Close Panel"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6 6 18" />
                                <path d="m6 6 12 12" />
                            </svg>
                        </button>
                        <div className="bottom-panel-content">
                            {renderActivePanelContent()}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

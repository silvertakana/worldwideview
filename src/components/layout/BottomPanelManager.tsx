"use client";

import React, { useRef, useState, useEffect } from "react";
import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import { Timeline } from "@/components/timeline/Timeline";
import "./BottomPanelManager.css";

export function BottomPanelManager() {
    const activeBottomPanel = useStore((s) => s.activeBottomPanel);
    const setActiveBottomPanel = useStore((s) => s.setActiveBottomPanel);
    const bottomPanelHeight = useStore((s) => s.bottomPanelHeight);
    const setBottomPanelHeight = useStore((s) => s.setBottomPanelHeight);

    const [isDragging, setIsDragging] = useState(false);
    const resizeRef = useRef<HTMLDivElement>(null);

    // Get all registered plugins that provide a bottom panel component
    const plugins = pluginManager.getAllPlugins().map((p) => p.plugin);
    const dockablePlugins = plugins.filter((p) => p.getBottomPanelComponent !== undefined);

    // Handle mouse drag for resizing the panel
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            // Calculate new height based on distance from bottom of window
            const newHeight = window.innerHeight - e.clientY;
            // Clamp between min 200px and max window height - 100px
            const clampedHeight = Math.max(200, Math.min(newHeight, window.innerHeight - 100));
            setBottomPanelHeight(clampedHeight);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging, setBottomPanelHeight]);

    // Handle mobile auto-close on load (legacy behavior from Timeline)
    useEffect(() => {
        if (window.innerWidth < 768 && activeBottomPanel !== null) {
            setActiveBottomPanel(null);
        }
    }, []);

    // Render active panel content
    const renderActivePanelContent = () => {
        if (activeBottomPanel === "timeline") {
            return <Timeline />;
        }

        const activePlugin = dockablePlugins.find(p => p.id === activeBottomPanel);
        if (activePlugin && activePlugin.getBottomPanelComponent) {
            const Component = activePlugin.getBottomPanelComponent();
            return <Component pluginId={activePlugin.id} />;
        }

        return null;
    };

    return (
        <div className="bottom-panel-system">
            {/* Dock: Always visible above the panel */}
            <div className="bottom-panel-dock">
                <button
                    className={`dock-btn glass-panel ${activeBottomPanel === "timeline" ? "active" : ""}`}
                    onClick={() => setActiveBottomPanel(activeBottomPanel === "timeline" ? null : "timeline")}
                    title="Timeline"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                </button>
                
                {dockablePlugins.map((plugin) => (
                    <button
                        key={plugin.id}
                        className={`dock-btn glass-panel ${activeBottomPanel === plugin.id ? "active" : ""}`}
                        onClick={() => setActiveBottomPanel(activeBottomPanel === plugin.id ? null : plugin.id)}
                        title={plugin.name || plugin.id}
                    >
                        {/* Placeholder icon, a real implementation might use an icon provided by the plugin metadata */}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <path d="M3 9h18" />
                        </svg>
                    </button>
                ))}
            </div>

            {/* Active Panel Shell */}
            <div 
                className={`bottom-panel glass-panel ${activeBottomPanel ? "open" : "closed"}`}
                style={{ height: activeBottomPanel ? `${bottomPanelHeight}px` : "0px" }}
            >
                {activeBottomPanel && (
                    <>
                        <div 
                            className="bottom-panel-resize-handle" 
                            ref={resizeRef}
                            onMouseDown={() => setIsDragging(true)}
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

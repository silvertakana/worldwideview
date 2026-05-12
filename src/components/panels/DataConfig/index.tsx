import { useStore } from "@/core/state/store";
import { FilterSection } from "@/components/panels/FilterPanel";
import { Cog, FilterIcon, Info, Key, MessageSquare } from "lucide-react";
import { useIsMobile } from "@/core/hooks/useIsMobile";
import { useResizablePanel } from "@/core/hooks/useResizablePanel";

import { IntelTab } from "./IntelTab";
import { CacheTab } from "./CacheTab";
import { OverlayTab } from "./OverlayTab";
import { sectionHeaderStyle } from "./sharedStyles";

import "./index.css";

export function DataConfigPanel() {
    const isMobile = useIsMobile();
    const { width, startResizing } = useResizablePanel(320, 260, 800, 'right');
    const configPanelOpen = useStore((s) => s.configPanelOpen);
    const openMobilePanel = useStore((s) => s.openMobilePanel);
    const selectedEntity = useStore((s) => s.selectedEntity);
    const setFeedbackDialogOpen = useStore((s) => s.setFeedbackDialogOpen);
    const activeTab = useStore((s) => s.activeConfigTab);
    const setActiveTab = useStore((s) => s.setActiveConfigTab);


    return (
        <aside
            className={`sidebar sidebar--right glass-panel ${isMobile ? "sidebar--mobile" : ""} ${(isMobile ? openMobilePanel === "right" : configPanelOpen) ? "" : "sidebar--closed"}`}
            style={{ width: isMobile ? undefined : width, padding: "var(--space-xl)", zIndex: 101, borderLeft: "var(--glass-border)" }}
        >
            {/* Drag Handle */}
            {!isMobile && (
                <div
                    onMouseDown={startResizing}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: -4,
                        width: 8,
                        height: '100%',
                        cursor: 'col-resize',
                        zIndex: 10,
                        backgroundColor: 'transparent'
                    }}
                />
            )}
            <div className="sidebar__title" style={{ marginBottom: "var(--space-md)", color: "var(--text-primary)", fontSize: "14px", fontWeight: 600 }}>
                Data Configuration
            </div>

            <div
                className="panel-tabs"
                onWheel={(e) => {
                    e.currentTarget.scrollLeft += e.deltaY;
                    e.preventDefault();
                }}
            >
                <button
                    className={`panel-tab ${activeTab === "intel" ? "panel-tab--active" : ""}`}
                    onClick={() => setActiveTab("intel")}
                    title="Intel"
                    style={{width: "100%"}}
                >
                    <Info size="20" style={{ margin: 5, maxHeight: "20%" }} />
                </button>
                <button
                    className={`panel-tab ${activeTab === "filters" ? "panel-tab--active" : ""}`}
                    onClick={() => setActiveTab("filters")}
                    title="Filters"
                    style={{width: "100%"}}
                >
                    <FilterIcon size="20" style={{ margin: 5, maxHeight: "20%" }} />
                </button>
                <button
                    className={`panel-tab ${activeTab === "overlay" ? "panel-tab--active" : ""}`}
                    onClick={() => setActiveTab("overlay")}
                    title="Config & Overlay"
                    style={{width: "100%"}}
                >
                    <Cog size="20" style={{ margin: 5, maxHeight: "20%" }} />
                </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", minHeight: 50, display: "flex", flexDirection: "column", paddingRight: "var(--space-xs)" }}>
                {activeTab === "intel" && (
                    <div style={{ marginBottom: "var(--space-lg)" }}>
                        <div style={sectionHeaderStyle}>Intelligence</div>
                        <IntelTab />
                    </div>
                )}

                {activeTab === "filters" && (
                    <div style={{ marginBottom: "var(--space-lg)" }}>
                        <div style={sectionHeaderStyle}>Entity Filters</div>
                        <FilterSection />
                    </div>
                )}
                {activeTab === "overlay" && <OverlayTab />}
            </div>

            <button 
                className="feedback-sidebar-link" 
                onClick={() => setFeedbackDialogOpen(true)}
                style={{width: "100%", height: "42px"}}
            >
                <MessageSquare size={16} />
                Provide Feedback
            </button>
        </aside>
    );
}

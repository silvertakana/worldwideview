import { useStore } from "@/core/state/store";
import { FilterSection } from "@/components/panels/FilterPanel";
import { Info, Key } from "lucide-react";

import { IntelTab } from "./IntelTab";
import { CacheTab } from "./CacheTab";
import { OverlayTab } from "./OverlayTab";
import { ApiKeysTab } from "./ApiKeysTab";
import { sectionHeaderStyle } from "./sharedStyles";

export function DataConfigPanel() {
    const configPanelOpen = useStore((s) => s.configPanelOpen);
    const selectedEntity = useStore((s) => s.selectedEntity);
    const activeTab = useStore((s) => s.activeConfigTab);
    const setActiveTab = useStore((s) => s.setActiveConfigTab);


    return (
        <aside
            className={`sidebar sidebar--right glass-panel ${configPanelOpen ? "" : "sidebar--closed"}`}
            style={{ width: 320, padding: "var(--space-xl)", zIndex: 101, borderLeft: "var(--glass-border)" }}
        >
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
                >
                    <Info size={12} style={{ marginRight: 4 }} />
                    Intel
                </button>
                <button
                    className={`panel-tab ${activeTab === "filters" ? "panel-tab--active" : ""}`}
                    onClick={() => setActiveTab("filters")}
                >
                    Filters
                </button>
                <button
                    className={`panel-tab ${activeTab === "cache" ? "panel-tab--active" : ""}`}
                    onClick={() => setActiveTab("cache")}
                >
                    Cache & Limits
                </button>
                <button
                    className={`panel-tab ${activeTab === "overlay" ? "panel-tab--active" : ""}`}
                    onClick={() => setActiveTab("overlay")}
                >
                    Config & Overlay
                </button>
                <button
                    className={`panel-tab ${activeTab === "apikeys" ? "panel-tab--active" : ""}`}
                    onClick={() => setActiveTab("apikeys")}
                >
                    <Key size={12} style={{ marginRight: 4 }} />
                    API Keys
                </button>
            </div>

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

            {activeTab === "cache" && <CacheTab />}
            {activeTab === "overlay" && <OverlayTab />}
            {activeTab === "apikeys" && <ApiKeysTab />}
        </aside>
    );
}

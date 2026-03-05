"use client";

import { useStore } from "@/core/state/store";
import { ChevronRight, ChevronLeft } from "lucide-react";

export function PanelToggleArrows() {
    const leftSidebarOpen = useStore((s) => s.leftSidebarOpen);
    const configPanelOpen = useStore((s) => s.configPanelOpen);

    const toggleLeftSidebar = useStore((s) => s.toggleLeftSidebar);
    const toggleConfigPanel = useStore((s) => s.toggleConfigPanel);

    const filterCount = useStore((s) =>
        Object.values(s.filters).reduce((sum, pf) => sum + Object.keys(pf).length, 0)
    );

    return (
        <>
            {/* Left Toggle */}
            <button
                className={`panel-toggle-btn panel-toggle-btn--left ${leftSidebarOpen ? "panel-toggle-btn--open" : ""}`}
                onClick={toggleLeftSidebar}
                title="Toggle Layers Panel"
            >
                {leftSidebarOpen ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
            </button>

            {/* Right Toggle */}
            <button
                className={`panel-toggle-btn panel-toggle-btn--right ${configPanelOpen ? "panel-toggle-btn--open" : ""}`}
                onClick={toggleConfigPanel}
                title="Toggle Data Configuration"
            >
                {configPanelOpen ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}

                {/* Notification Badge for active filters */}
                {filterCount > 0 && !configPanelOpen && (
                    <span className="filter-badge filter-badge--toggle">
                        {filterCount}
                    </span>
                )}
            </button>
        </>
    );
}

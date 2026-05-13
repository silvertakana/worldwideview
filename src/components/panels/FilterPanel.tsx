/**
 * @file FilterPanel.tsx
 * @description UI components for managing dynamic data filters across all active plugins.
 * Supports text search, value selection, range sliders, and boolean toggles.
 * @module src/components/panels
 */

import { useState } from "react";
import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import { TextFilter, SelectFilter, RangeFilter, BooleanFilter, FilterControl } from "./FilterControls";
import { PluginIcon } from "@/components/common/PluginIcon";
import type { FilterDefinition, FilterValue } from "@/core/plugins/PluginTypes";
import { trackEvent } from "@/lib/analytics";

/**
 * @component FilterSection
 * @description An embeddable list of filter controls, grouped by plugin.
 * Only displays filters for plugins that are currently enabled in the LayerPanel.
 */
export function FilterSection() {
    const layers = useStore((s) => s.layers);
    const filters = useStore((s) => s.filters);
    const setFilter = useStore((s) => s.setFilter);
    const clearFilters = useStore((s) => s.clearFilters);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const allPlugins = pluginManager.getAllPlugins();
    const enabledPlugins = allPlugins.filter(
        (m) => layers[m.plugin.id]?.enabled && m.plugin.getFilterDefinitions
    );

    if (enabledPlugins.length === 0) {
        return (
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", padding: "var(--space-sm) 0" }}>
                Enable a layer to see its filters.
            </div>
        );
    }

    return (
        <>
            {enabledPlugins.map((managed) => {
                const pluginId = managed.plugin.id;
                const defs = managed.plugin.getFilterDefinitions?.() || [];
                const activeCount = Object.keys(filters[pluginId] || {}).length;
                const isCollapsed = collapsed[pluginId] ?? false;

                return (
                    <div key={pluginId} className="filter-section">
                        <button
                            className="filter-section__header"
                            onClick={() => setCollapsed((c) => ({ ...c, [pluginId]: !c[pluginId] }))}
                        >
                            <span className="filter-section__icon">
                                <PluginIcon icon={managed.plugin.icon} size={14} />
                            </span>
                            <span className="filter-section__name">{managed.plugin.name}</span>
                            {activeCount > 0 && <span className="filter-badge">{activeCount}</span>}
                            <span className={`filter-section__chevron ${isCollapsed ? "" : "filter-section__chevron--open"}`}>▸</span>
                        </button>

                        {!isCollapsed && (
                            <div className="filter-section__body">
                                {defs.map((def) => (
                                    <FilterControl
                                        key={def.id}
                                        def={def}
                                        value={filters[pluginId]?.[def.id]}
                                        onChange={(v) => { setFilter(pluginId, def.id, v); trackEvent("filter-change", { plugin: pluginId, filter: def.id }); }}
                                    />
                                ))}
                                {activeCount > 0 && (
                                    <button
                                        className="filter-clear-btn"
                                        onClick={() => { clearFilters(pluginId); trackEvent("filter-clear", { plugin: pluginId }); }}
                                    >
                                        Clear Filters
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </>
    );
}

"use client";

import { useState } from "react";
import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import { TextFilter, SelectFilter, RangeFilter, BooleanFilter } from "./FilterControls";
import { PluginIcon } from "@/components/common/PluginIcon";
import type { FilterDefinition, FilterValue } from "@/core/plugins/PluginTypes";

function FilterControl({ def, value, onChange }: {
    def: FilterDefinition;
    value: FilterValue | undefined;
    onChange: (v: FilterValue) => void;
}) {
    const props = { definition: def, value, onChange };
    switch (def.type) {
        case "text": return <TextFilter {...props} />;
        case "select": return <SelectFilter {...props} />;
        case "range": return <RangeFilter {...props} />;
        case "boolean": return <BooleanFilter {...props} />;
        default: return null;
    }
}

/** Embeddable filter section — designed to be placed inside DataConfigPanel */
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
                                        onChange={(v) => setFilter(pluginId, def.id, v)}
                                    />
                                ))}
                                {activeCount > 0 && (
                                    <button
                                        className="filter-clear-btn"
                                        onClick={() => clearFilters(pluginId)}
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

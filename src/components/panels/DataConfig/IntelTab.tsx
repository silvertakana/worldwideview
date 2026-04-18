import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import { PluginIcon } from "@/components/common/PluginIcon";
import { Eye, MapPin, Lock, Unlock, Star, ExternalLink, Maximize2, Filter, RotateCcw } from "lucide-react";
import { dataBus } from "@/core/data/DataBus";
import { sectionHeaderStyle } from "./sharedStyles";
import { TimestampProperty } from "../properties/TimestampProperty";
import { DynamicPropertiesRender } from "../properties/DynamicPropertiesRender";
import { useRef, useEffect } from "react";
import { PluginErrorBoundary } from "@/components/common/PluginErrorBoundary";

function LegendItem({
    label, 
    color, 
    pluginId, 
    colorOverrides, 
    updatePluginSettings, 
    isFilterable = false, 
    isActive = true, 
    toggleFilter = () => {},
    isDefault = false,
    customLayerColor = null
}: { 
    label: string, 
    color: string, 
    pluginId: string, 
    colorOverrides?: Record<string, string>, 
    updatePluginSettings: (id: string, s: any) => void,
    isFilterable?: boolean,
    isActive?: boolean,
    toggleFilter?: () => void,
    isDefault?: boolean,
    customLayerColor?: string | null
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const displayColor = isDefault 
        ? (customLayerColor || color)
        : (colorOverrides?.[color] || color);
    
    const hasOverride = isDefault 
        ? !!customLayerColor 
        : !!colorOverrides?.[color];

    const actualColorForInput = displayColor.startsWith("#") ? displayColor : "#3b82f6";

    return (
        <div 
            style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "var(--space-md)", 
                background: "rgba(255,255,255,0.03)", 
                padding: "var(--space-sm) var(--space-md)", 
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                opacity: isActive ? 1 : 0.4,
                transition: "all var(--duration-fast)",
                border: "1px solid rgba(255,255,255,0.05)",
                position: "relative",
                overflow: "hidden"
            }}
            onClick={() => inputRef.current?.click()}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
            }}
        >
            <input
                ref={inputRef}
                type="color"
                value={actualColorForInput}
                onChange={(e) => {
                    if (isDefault) {
                        updatePluginSettings(pluginId, { customLayerColor: e.target.value });
                    } else if (colorOverrides) {
                        updatePluginSettings(pluginId, {
                            colorOverrides: { ...colorOverrides, [color]: e.target.value }
                        });
                    }
                }}
                style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
            />

            <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "3px",
                height: "100%",
                background: displayColor,
                boxShadow: `0 0 10px ${displayColor}88`
            }} />

            <div style={{
                width: 16,
                height: 16,
                borderRadius: "var(--radius-sm)",
                backgroundColor: displayColor,
                border: "1px solid rgba(255,255,255,0.2)",
                boxShadow: `0 0 8px ${displayColor}44`,
                flexShrink: 0
            }} />
            
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1px" }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{label}</span>
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "0.02em" }}>{displayColor.toUpperCase()}</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                {isFilterable && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); toggleFilter(); }}
                        title={isActive ? "Disable filter" : "Enable filter"}
                        style={{
                            background: isActive ? "rgba(0, 255, 255, 0.1)" : "transparent",
                            border: "none",
                            color: isActive ? "var(--accent-cyan)" : "var(--text-muted)",
                            padding: "6px",
                            borderRadius: "var(--radius-sm)",
                            display: "flex",
                            cursor: "pointer"
                        }}
                    >
                        <Filter size={14} />
                    </button>
                )}
                {hasOverride && (
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (isDefault) {
                                updatePluginSettings(pluginId, { customLayerColor: null });
                            } else if (colorOverrides) {
                                const newOverrides = { ...colorOverrides };
                                delete newOverrides[color];
                                updatePluginSettings(pluginId, { colorOverrides: newOverrides });
                            }
                        }}
                        title="Reset to default"
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--text-muted)",
                            padding: "6px",
                            borderRadius: "var(--radius-sm)",
                            display: "flex",
                            cursor: "pointer"
                        }}
                    >
                        <RotateCcw size={14} />
                    </button>
                )}
            </div>
        </div>
    );
}

export function IntelTab() {
    const selectedEntity = useStore((s) => s.selectedEntity);
    const lockedEntityId = useStore((s) => s.lockedEntityId);
    const setLockedEntityId = useStore((s) => s.setLockedEntityId);
    const favorites = useStore((s) => s.favorites);
    const addFavorite = useStore((s) => s.addFavorite);
    const removeFavorite = useStore((s) => s.removeFavorite);
    const highlightLayerId = useStore((s) => s.highlightLayerId);
    const filters = useStore((s) => s.filters);
    const setFilter = useStore((s) => s.setFilter);
    const updatePluginSettings = useStore((s) => s.updatePluginSettings);
    const pluginSettings = useStore((s) => s.dataConfig.pluginSettings);

    if (!selectedEntity) {
        if (highlightLayerId) {
            const layerPlugin = pluginManager.getPlugin(highlightLayerId);
            if (layerPlugin) {
                const layerConfig = layerPlugin.plugin.getLayerConfig();
                const SidebarComp = layerPlugin.plugin.getSidebarComponent?.();
                const defaultColor = layerConfig?.color || "var(--accent-cyan)";
                const legend = layerPlugin.plugin.getLegend?.();
                const pluginId = layerPlugin.plugin.id;
                const settings = pluginSettings[pluginId] || {};
                const colorOverrides = settings.colorOverrides || {};

                return (
                    <div style={{ padding: "var(--space-md)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
                            <PluginIcon icon={layerPlugin.plugin.icon} size={20} />
                            <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                                {layerPlugin.plugin.name} Layer
                            </span>
                        </div>
                        <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: "var(--space-lg)", lineHeight: 1.5 }}>
                            {layerPlugin.plugin.description}
                        </div>

                        {SidebarComp && (
                            <div style={{ marginBottom: "var(--space-lg)", paddingBottom: "var(--space-lg)", borderBottom: "1px solid var(--border-subtle)" }}>
                                <PluginErrorBoundary pluginId={layerPlugin.plugin.id}>
                                    <SidebarComp plugin={layerPlugin.plugin} />
                                </PluginErrorBoundary>
                            </div>
                        )}

                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                {legend && legend.length > 1 ? "Data Point Colors" : "Data Point Color"}
                            </span>
                            
                            {legend && legend.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                                    {legend.map((item, idx) => {
                                        const isFilterable = Boolean(item.filterId && item.filterValue);
                                        const currentFilter = isFilterable ? filters[layerPlugin.plugin.id]?.[item.filterId!] : undefined;
                                        
                                        // Determine active state for highlighting
                                        let isActive = true;
                                        if (isFilterable && currentFilter?.type === "select" && currentFilter.values.length > 0) {
                                            isActive = currentFilter.values.includes(item.filterValue!);
                                        }

                                        const toggleFilter = () => {
                                            if (!isFilterable) return;
                                            const filterId = item.filterId!;
                                            const filterVal = item.filterValue!;
                                            
                                            const currentValues = currentFilter?.type === "select" ? currentFilter.values : [];
                                            
                                            if (!currentFilter || currentValues.length === 0) {
                                                // Isolate this item
                                                setFilter(pluginId, filterId, { type: "select", values: [filterVal] });
                                            } else {
                                                // Toggle this item
                                                if (currentValues.includes(filterVal)) {
                                                    const newValues = currentValues.filter((v: string) => v !== filterVal);
                                                    setFilter(pluginId, filterId, { type: "select", values: newValues });
                                                } else {
                                                    const newValues = [...currentValues, filterVal];
                                                    setFilter(pluginId, filterId, { type: "select", values: newValues });
                                                }
                                            }
                                        };

                                        return (
                                            <LegendItem 
                                                key={idx}
                                                label={item.label}
                                                color={item.color}
                                                pluginId={pluginId}
                                                colorOverrides={colorOverrides}
                                                updatePluginSettings={updatePluginSettings}
                                                isFilterable={isFilterable}
                                                isActive={isActive}
                                                toggleFilter={toggleFilter}
                                            />
                                        );
                                    })}
                                </div>
                            ) : (
                                <LegendItem 
                                    label="Default Layer Color"
                                    color={defaultColor}
                                    pluginId={pluginId}
                                    updatePluginSettings={updatePluginSettings}
                                    isDefault={true}
                                    customLayerColor={settings.customLayerColor}
                                />
                            )}
                        </div>
                    </div>
                );
            }
        }

        return (
            <div style={{ padding: "var(--space-md)", color: "var(--text-muted)", fontSize: 13, fontStyle: "italic", textAlign: "center" }}>
                Select an entity on the map to view its intelligence report.
            </div>
        );
    }

    const managed = pluginManager.getPlugin(selectedEntity.pluginId);
    const pluginIcon = managed?.plugin.icon;
    const pluginName = managed?.plugin.name || selectedEntity.pluginId;

    const displayProps = Object.entries(selectedEntity.properties).filter(
        ([key]) =>
            !["id", "pluginId"].includes(key) &&
            selectedEntity.properties[key] !== null &&
            selectedEntity.properties[key] !== undefined
    );

    const DetailComp = managed?.plugin.getDetailComponent?.();

    const isFavorited = favorites.some((f) => f.id === selectedEntity.id);

    return (
        <div className="intel-panel__entity">
            <div className="intel-panel__entity-header">
                <span className="intel-panel__entity-icon">
                    {pluginIcon && <PluginIcon icon={pluginIcon} size={20} />}
                </span>
                <div style={{ flex: 1 }}>
                    <div className="intel-panel__entity-title">
                        {selectedEntity.label || selectedEntity.id}
                    </div>
                    <div className="intel-panel__entity-subtitle">{pluginName}</div>
                </div>
                <button
                    className="intel-panel__close"
                    style={{ position: "relative", top: 0, right: 0 }}
                    onClick={() => {
                        if (isFavorited) {
                            removeFavorite(selectedEntity.id);
                        } else {
                            addFavorite(selectedEntity, pluginName, pluginIcon);
                        }
                    }}
                    title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                >
                    <Star size={14} fill={isFavorited ? "currentColor" : "none"} />
                </button>
            </div>
            <div className="intel-panel__props">
                <div className="intel-panel__prop">
                    <span className="intel-panel__prop-key">Latitude</span>
                    <span className="intel-panel__prop-value">
                        {selectedEntity.latitude.toFixed(4)}°
                    </span>
                </div>
                <div className="intel-panel__prop">
                    <span className="intel-panel__prop-key">Longitude</span>
                    <span className="intel-panel__prop-value">
                        {selectedEntity.longitude.toFixed(4)}°
                    </span>
                </div>
                {selectedEntity.altitude !== undefined && (
                    <div className="intel-panel__prop">
                        <span className="intel-panel__prop-key">Altitude</span>
                        <span className="intel-panel__prop-value">
                            {selectedEntity.altitude.toFixed(0)} m
                        </span>
                    </div>
                )}
                <TimestampProperty timestamp={selectedEntity.timestamp} />

                {DetailComp ? (
                    <div className="intel-panel__custom-detail" style={{ marginTop: "var(--space-md)", maxWidth: "100%", overflow: "hidden" }}>
                        <PluginErrorBoundary pluginId={selectedEntity.pluginId}>
                            <DetailComp entity={selectedEntity} />
                        </PluginErrorBoundary>
                    </div>
                ) : (
                    <DynamicPropertiesRender entity={selectedEntity} />
                )}
            </div>
            <div className="intel-panel__actions">
                <button
                    className="intel-panel__action-btn"
                    title="Face towards"
                    onClick={() => {
                        console.log("[Intel] Face button clicked", selectedEntity.latitude, selectedEntity.longitude);
                        dataBus.emit("cameraFaceTowards", {
                            lat: selectedEntity.latitude,
                            lon: selectedEntity.longitude,
                            alt: selectedEntity.altitude || 0,
                        });
                    }}
                >
                    <Eye size={14} />
                    <span>Face</span>
                </button>
                <button
                    className="intel-panel__action-btn"
                    title="Go to entity"
                    onClick={() => {
                        console.log("[Intel] Go To button clicked", selectedEntity.latitude, selectedEntity.longitude);
                        const behavior = managed?.plugin.getSelectionBehavior?.(selectedEntity);
                        dataBus.emit("cameraGoTo", {
                            lat: selectedEntity.latitude,
                            lon: selectedEntity.longitude,
                            alt: selectedEntity.altitude || 0,
                            distance: behavior?.flyToBaseDistance
                        });
                    }}
                >
                    <MapPin size={14} />
                    <span>Go To</span>
                </button>
                <button
                    className={`intel-panel__action-btn ${lockedEntityId === selectedEntity.id ? "intel-panel__action-btn--active" : ""}`}
                    title={lockedEntityId === selectedEntity.id ? "Unlock camera" : "Lock camera to entity"}
                    onClick={() => setLockedEntityId(
                        lockedEntityId === selectedEntity.id ? null : selectedEntity.id
                    )}
                >
                    {lockedEntityId === selectedEntity.id
                        ? <><Unlock size={14} /><span>Unlock</span></>
                        : <><Lock size={14} /><span>Lock</span></>
                    }
                </button>
            </div>
        </div>
    );
}

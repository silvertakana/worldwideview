import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import { PluginIcon } from "@/components/common/PluginIcon";
import { Eye, MapPin, Lock, Unlock, Star, ExternalLink, Maximize2 } from "lucide-react";
import { dataBus } from "@/core/data/DataBus";
import { sectionHeaderStyle } from "./sharedStyles";

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
    const addFloatingStream = useStore((s) => s.addFloatingStream);

    if (!selectedEntity) {
        if (highlightLayerId) {
            const layerPlugin = pluginManager.getPlugin(highlightLayerId);
            if (layerPlugin) {
                const layerConfig = layerPlugin.plugin.getLayerConfig();
                const defaultColor = layerConfig?.color || "var(--accent-cyan)";
                const legend = layerPlugin.plugin.getLegend?.();

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
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                {legend && legend.length > 1 ? "Data Point Colors" : "Data Point Color"}
                            </span>
                            
                            {legend && legend.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
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
                                            const pluginId = layerPlugin.plugin.id;
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
                                            <div 
                                                key={idx} 
                                                style={{ 
                                                    display: "flex", 
                                                    alignItems: "center", 
                                                    gap: "var(--space-sm)", 
                                                    background: "rgba(255,255,255,0.03)", 
                                                    padding: "var(--space-sm)", 
                                                    borderRadius: "var(--radius-sm)",
                                                    cursor: isFilterable ? "pointer" : "default",
                                                    opacity: isActive ? 1 : 0.4,
                                                    transition: "opacity var(--duration-fast)"
                                                }}
                                                onClick={toggleFilter}
                                                title={isFilterable ? "Click to filter by this category" : ""}
                                            >
                                                <span style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: item.color, display: "inline-block", border: "1px solid rgba(255,255,255,0.2)", boxShadow: "0 0 6px rgba(0,0,0,0.5)", flexShrink: 0 }} />
                                                <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{item.label}</span>
                                                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginLeft: "auto" }}>{item.color}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", background: "rgba(255,255,255,0.03)", padding: "var(--space-sm)", borderRadius: "var(--radius-sm)" }}>
                                    <span style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: defaultColor, display: "inline-block", border: "1px solid rgba(255,255,255,0.2)", boxShadow: "0 0 6px rgba(0,0,0,0.5)" }} />
                                    <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{defaultColor}</span>
                                </div>
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
                <div className="intel-panel__prop">
                    <span className="intel-panel__prop-key">Timestamp</span>
                    <span className="intel-panel__prop-value">
                        {new Date(selectedEntity.timestamp).toLocaleTimeString()}
                    </span>
                </div>

                {DetailComp ? (
                    <div className="intel-panel__custom-detail" style={{ marginTop: "var(--space-md)", maxWidth: "100%", overflow: "hidden" }}>
                        <DetailComp entity={selectedEntity} />
                    </div>
                ) : (
                    <>
                        {displayProps.map(([key, value]) => {
                            const isImage = typeof value === "string" && key.toLowerCase().includes("image") && /^https?:\/\//i.test(value);
                            const isUrl = !isImage && typeof value === "string" && /^https?:\/\//i.test(value);
                            const isLongText = typeof value === "string" && value.length > 50;

                            if (isImage) {
                                return (
                                    <div key={key} style={{ marginTop: "var(--space-md)", paddingTop: "var(--space-sm)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                                        <span className="intel-panel__prop-key" style={{ marginBottom: 8, display: "block" }}>
                                            {key.replace(/_/g, " ")}
                                        </span>
                                        <div style={{ position: "relative", borderRadius: "var(--radius-md)", overflow: "hidden", background: "rgba(0,0,0,0.2)", display: "flex", justifyContent: "center" }}>
                                            <img src={value as string} alt={key} style={{ width: "100%", maxHeight: "200px", objectFit: "cover", display: "block" }} />
                                            <button
                                                className="intel-panel__img-popout"
                                                onClick={() => addFloatingStream({
                                                    id: `image_${selectedEntity.id}_${key}`,
                                                    streamUrl: value as string,
                                                    isIframe: false,
                                                    label: `${selectedEntity.label || selectedEntity.id} - ${key.replace(/_/g, " ")}`,
                                                    type: "image"
                                                })}
                                                title="Popout Image"
                                            >
                                                <Maximize2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            if (isLongText || isUrl) {
                                return (
                                    <div key={key} style={{ display: "flex", flexDirection: "column", marginTop: "var(--space-md)", paddingTop: "var(--space-sm)", borderTop: "1px solid rgba(255,255,255,0.05)", minWidth: 0 }}>
                                        <span className="intel-panel__prop-key" style={{ marginBottom: 6 }}>
                                            {key.replace(/_/g, " ")}
                                        </span>
                                        {isUrl ? (
                                            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", width: "100%" }}>
                                                <div 
                                                    style={{ 
                                                        flex: 1, 
                                                        overflowX: "auto", 
                                                        whiteSpace: "nowrap",
                                                        fontSize: 13,
                                                        fontFamily: "var(--font-mono)",
                                                        color: "var(--text-primary)",
                                                        paddingBottom: 2
                                                    }}
                                                >
                                                    {String(value)}
                                                </div>
                                                <a href={value as string} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-cyan)", display: "flex", flexShrink: 0 }} title="Open Link">
                                                    <ExternalLink size={14} />
                                                </a>
                                            </div>
                                        ) : (
                                            <span className="intel-panel__prop-value" style={{ textAlign: "left", lineHeight: 1.5, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                                                {String(value)}
                                            </span>
                                        )}
                                    </div>
                                );
                            }

                            return (
                                <div key={key} className="intel-panel__prop">
                                    <span className="intel-panel__prop-key">
                                        {key.replace(/_/g, " ")}
                                    </span>
                                    <span className="intel-panel__prop-value">
                                        {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
                                    </span>
                                </div>
                            );
                        })}
                    </>
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
                        dataBus.emit("cameraGoTo", {
                            lat: selectedEntity.latitude,
                            lon: selectedEntity.longitude,
                            alt: selectedEntity.altitude || 0,
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

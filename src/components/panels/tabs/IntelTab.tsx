import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import { PluginIcon } from "@/components/common/PluginIcon";
import { Eye, MapPin, Lock, Unlock } from "lucide-react";
import { dataBus } from "@/core/data/DataBus";
import { TimestampProperty } from "../properties/TimestampProperty";
import { DynamicPropertiesRender } from "../properties/DynamicPropertiesRender";

const sectionHeaderStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    marginBottom: "var(--space-sm)",
    borderBottom: "1px solid var(--border-subtle)",
    paddingBottom: "var(--space-xs)"
};

export function IntelTab() {
    const selectedEntity = useStore((s) => s.selectedEntity);
    const lockedEntityId = useStore((s) => s.lockedEntityId);
    const setLockedEntityId = useStore((s) => s.setLockedEntityId);

    return (
        <div style={{ marginBottom: "var(--space-lg)" }}>
            <div style={sectionHeaderStyle}>Intelligence</div>
            {!selectedEntity ? (
                <div style={{ padding: "var(--space-md)", color: "var(--text-muted)", fontSize: 13, fontStyle: "italic", textAlign: "center" }}>
                    Select an entity on the map to view its intelligence report.
                </div>
            ) : (() => {
                const managed = pluginManager.getPlugin(selectedEntity.pluginId);
                const pluginIcon = managed?.plugin.icon;
                const pluginName = managed?.plugin.name || selectedEntity.pluginId;

                const displayProps = Object.entries(selectedEntity.properties).filter(
                    ([key]) =>
                        !["id", "pluginId"].includes(key) &&
                        selectedEntity.properties[key] !== null &&
                        selectedEntity.properties[key] !== undefined
                );

                return (
                    <div className="intel-panel__entity">
                        <div className="intel-panel__entity-header">
                            <span className="intel-panel__entity-icon">
                                {pluginIcon && <PluginIcon icon={pluginIcon} size={20} />}
                            </span>
                            <div>
                                <div className="intel-panel__entity-title">
                                    {selectedEntity.label || selectedEntity.id}
                                </div>
                                <div className="intel-panel__entity-subtitle">{pluginName}</div>
                            </div>
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

                            {/* Custom Plugin Detail Component */}
                            {(() => {
                                const DetailComp = managed?.plugin.getDetailComponent?.();
                                if (DetailComp) {
                                    return (
                                        <div className="intel-panel__custom-detail" style={{ marginTop: "var(--space-md)", maxWidth: "100%", overflow: "hidden" }}>
                                            <DetailComp entity={selectedEntity} />
                                        </div>
                                    );
                                }
                                return (
                                    <DynamicPropertiesRender entity={selectedEntity} />
                                );
                            })()}
                        </div>
                        {/* Action Buttons */}
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
            })()}
        </div>
    );
}

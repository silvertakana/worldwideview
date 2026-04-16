"use client";

import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import { PluginIcon } from "@/components/common/PluginIcon";
import { TimestampProperty } from "./properties/TimestampProperty";

const CARD_WIDTH = 260;
const CARD_HEIGHT_EST = 180;
const OFFSET_X = 16;
const OFFSET_Y = 16;
const EDGE_PADDING = 12;

const LEVEL_COLORS: Record<string, string> = {
    low: "#facc15", medium: "#f97316", high: "#ef4444",
};

const SEVERITY_LABELS: Record<number, string> = {
    5: "Critical", 4: "High", 3: "Elevated", 2: "Watchlist",
};

export function EntityInfoCard() {
    const hoveredEntity = useStore((s) => s.hoveredEntity);
    const screenPos = useStore((s) => s.hoveredScreenPosition);
    const selectedEntity = useStore((s) => s.selectedEntity);

    // Don't show the hover card if an entity is selected (IntelPanel is open)
    // or if the hovered entity IS the selected entity
    if (
        !hoveredEntity ||
        !screenPos ||
        (selectedEntity && selectedEntity.id === hoveredEntity.id)
    )
        return null;

    // Find plugin info
    const managed = pluginManager.getPlugin(hoveredEntity.pluginId);
    const pluginIcon = managed?.plugin.icon;
    const pluginName = managed?.plugin.name || hoveredEntity.pluginId;

    // Clamp position to keep card within viewport
    let x = screenPos.x + OFFSET_X;
    let y = screenPos.y + OFFSET_Y;

    if (typeof window !== "undefined") {
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        if (x + CARD_WIDTH > vw - EDGE_PADDING) {
            x = screenPos.x - CARD_WIDTH - OFFSET_X;
        }
        if (y + CARD_HEIGHT_EST > vh - EDGE_PADDING) {
            y = screenPos.y - CARD_HEIGHT_EST - OFFSET_Y;
        }
        if (x < EDGE_PADDING) x = EDGE_PADDING;
        if (y < EDGE_PADDING) y = EDGE_PADDING;
    }

    // Format values
    const altitude = hoveredEntity.altitude;
    const altitudeDisplay =
        altitude !== undefined ? `${(altitude / 10).toFixed(0)} m` : null;

    const speed = hoveredEntity.speed;
    const speedDisplay =
        speed !== undefined ? `${speed.toFixed(0)} m/s` : null;

    const heading = hoveredEntity.heading;
    const headingDisplay =
        heading !== undefined ? `${heading.toFixed(0)}°` : null;

    const typeDisplay = 
        hoveredEntity.properties?.type !== undefined ? String(hoveredEntity.properties.type) : null;
    
    const casualtiesDisplay = 
        hoveredEntity.properties?.casualties !== undefined ? String(hoveredEntity.properties.casualties) : null;

    // Sanctions-specific fields
    const sanctionLevel = hoveredEntity.properties?.level as string | undefined;
    const sanctionCount = hoveredEntity.properties?.count as number | undefined;
    const countryCode = hoveredEntity.properties?.countryCode as string | undefined;
    const isSanctions = hoveredEntity.pluginId === "international-sanctions";

    // Conflict zone-specific fields
    const escalationScore = hoveredEntity.properties?.escalationScore as number | undefined;
    const zoneStatus = hoveredEntity.properties?.status as string | undefined;
    const escalationTrend = hoveredEntity.properties?.escalationTrend as string | undefined;
    const isConflictZone = hoveredEntity.pluginId === "conflict-zones";

    return (
        <div
            className="entity-info-card"
            style={{
                left: `${x}px`,
                top: `${y}px`,
                width: `${CARD_WIDTH}px`,
            }}
        >
            {/* Header */}
            <div className="entity-info-card__header">
                <span className="entity-info-card__icon">
                    {pluginIcon && <PluginIcon icon={pluginIcon} size={16} />}
                </span>
                <div className="entity-info-card__title-group">
                    <div className="entity-info-card__title">
                        {hoveredEntity.label || hoveredEntity.id}
                    </div>
                    <div className="entity-info-card__badge">{pluginName}</div>
                </div>
            </div>

            {/* Properties */}
            <div className="entity-info-card__props">
                <div className="entity-info-card__prop">
                    <span className="entity-info-card__prop-key">Position</span>
                    <span className="entity-info-card__prop-value">
                        {hoveredEntity.latitude.toFixed(3)}°,{" "}
                        {hoveredEntity.longitude.toFixed(3)}°
                    </span>
                </div>
                {hoveredEntity.timestamp && (
                    <TimestampProperty timestamp={hoveredEntity.timestamp} classNamePrefix="entity-info-card" />
                )}
                {typeDisplay && (
                    <div className="entity-info-card__prop">
                        <span className="entity-info-card__prop-key">Type</span>
                        <span className="entity-info-card__prop-value">
                            {typeDisplay.length > 30 ? `${typeDisplay.substring(0, 30)}...` : typeDisplay}
                        </span>
                    </div>
                )}
                {altitudeDisplay && (
                    <div className="entity-info-card__prop">
                        <span className="entity-info-card__prop-key">
                            Altitude
                        </span>
                        <span className="entity-info-card__prop-value">
                            {altitudeDisplay}
                        </span>
                    </div>
                )}
                {speedDisplay && (
                    <div className="entity-info-card__prop">
                        <span className="entity-info-card__prop-key">
                            Speed
                        </span>
                        <span className="entity-info-card__prop-value">
                            {speedDisplay}
                        </span>
                    </div>
                )}
                {headingDisplay && (
                    <div className="entity-info-card__prop">
                        <span className="entity-info-card__prop-key">
                            Heading
                        </span>
                        <span className="entity-info-card__prop-value">
                            {headingDisplay}
                        </span>
                    </div>
                )}
                {casualtiesDisplay && (
                    <div className="entity-info-card__prop">
                        <span className="entity-info-card__prop-key">
                            Casualties
                        </span>
                        <span className="entity-info-card__prop-value">
                            {casualtiesDisplay}
                        </span>
                    </div>
                )}

                {/* Sanctions-specific hover intel */}
                {isSanctions && countryCode && (
                    <div className="entity-info-card__prop">
                        <span className="entity-info-card__prop-key">Country</span>
                        <span className="entity-info-card__prop-value">{countryCode}</span>
                    </div>
                )}
                {isSanctions && sanctionLevel && (
                    <div className="entity-info-card__prop">
                        <span className="entity-info-card__prop-key">Severity</span>
                        <span className="entity-info-card__prop-value" style={{ color: LEVEL_COLORS[sanctionLevel] || "inherit" }}>
                            {sanctionLevel.toUpperCase()}
                        </span>
                    </div>
                )}
                {isSanctions && sanctionCount !== undefined && (
                    <div className="entity-info-card__prop">
                        <span className="entity-info-card__prop-key">OFAC Sanctions</span>
                        <span className="entity-info-card__prop-value">{sanctionCount}</span>
                    </div>
                )}

                {/* Conflict zone-specific hover intel */}
                {isConflictZone && escalationScore !== undefined && (
                    <div className="entity-info-card__prop">
                        <span className="entity-info-card__prop-key">Escalation</span>
                        <span className="entity-info-card__prop-value" style={{ color: escalationScore >= 5 ? "#991b1b" : escalationScore >= 4 ? "#ef4444" : escalationScore >= 3 ? "#f97316" : "#fbbf24" }}>
                            {SEVERITY_LABELS[escalationScore] || escalationScore} / 5
                        </span>
                    </div>
                )}
                {isConflictZone && zoneStatus && (
                    <div className="entity-info-card__prop">
                        <span className="entity-info-card__prop-key">Status</span>
                        <span className="entity-info-card__prop-value">{zoneStatus}</span>
                    </div>
                )}
                {isConflictZone && escalationTrend && (
                    <div className="entity-info-card__prop">
                        <span className="entity-info-card__prop-key">Trend</span>
                        <span className="entity-info-card__prop-value">{escalationTrend}</span>
                    </div>
                )}
            </div>

            {/* Footer hint */}
            <div className="entity-info-card__hint">Click for details</div>
        </div>
    );
}


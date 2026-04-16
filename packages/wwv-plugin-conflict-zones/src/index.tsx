import React from "react";
import { Crosshair } from "lucide-react";
import * as Cesium from "cesium";
import { Entity, EllipseGraphics } from "resium";
import {
    createSvgIconUrl,
    type WorldPlugin, type GeoEntity, type TimeRange,
    type PluginContext, type LayerConfig, type CesiumEntityOptions,
    type FilterDefinition,
} from "@worldwideview/wwv-plugin-sdk";
import { CONFLICT_ZONES } from "./zones";

function severityToColor(score: number): string {
    if (score >= 5) return "#991b1b"; // Critical — dark red
    if (score >= 4) return "#ef4444"; // High — red
    if (score >= 3) return "#f97316"; // Elevated — orange
    return "#fbbf24"; // Monitoring — yellow
}

/** Attach _wwvEntity to a Resium Entity ref so InteractionHandler can pick it. */
function bindWwvEntity(ref: any, geoEntity: GeoEntity): void {
    const cesiumEntity = ref?.cesiumElement;
    if (cesiumEntity && !cesiumEntity._wwvEntity) {
        cesiumEntity._wwvEntity = geoEntity;
    }
}

/** Build a synthetic GeoEntity from a static ConflictZone definition. */
function zoneToGeoEntity(zone: typeof CONFLICT_ZONES[number]): GeoEntity {
    return {
        id: zone.id,
        pluginId: "conflict-zones",
        latitude: zone.lat,
        longitude: zone.lon,
        altitude: 0,
        timestamp: new Date(),
        properties: {
            name: zone.name,
            description: zone.description,
            type: zone.subtext || "N/A",
            status: zone.status,
            escalationScore: zone.escalationScore,
            escalationTrend: zone.escalationTrend,
            whyItMatters: zone.whyItMatters,
            radiusKm: zone.radiusKm,
        },
    };
}

const ConflictZonesRenderer: React.FC<{ viewer: Cesium.Viewer | null; enabled: boolean }> = ({ enabled }) => {
    if (!enabled) return null;

    return (
        <>
            {CONFLICT_ZONES.map(zone => {
                const position = Cesium.Cartesian3.fromDegrees(zone.lon, zone.lat);
                const colorHex = severityToColor(zone.escalationScore);
                const fillColor = Cesium.Color.fromCssColorString(colorHex).withAlpha(0.25);
                const outlineColor = Cesium.Color.fromCssColorString(colorHex).withAlpha(0.8);
                const radiusMeters = zone.radiusKm * 1000;
                const geoEntity = zoneToGeoEntity(zone);

                return (
                    <Entity
                        key={zone.id}
                        position={position}
                        name={zone.name}
                        ref={(ref: any) => bindWwvEntity(ref, geoEntity)}
                    >
                        <EllipseGraphics
                            semiMajorAxis={radiusMeters}
                            semiMinorAxis={radiusMeters}
                            material={fillColor}
                            outline={true}
                            outlineColor={outlineColor}
                            outlineWidth={3}
                            height={0}
                        />
                    </Entity>
                );
            })}
        </>
    );
};

export class ConflictZonesPlugin implements WorldPlugin {
    id = "conflict-zones";
    name = "Conflict Zones";
    description = "Active conflict zones and geopolitical hotspots worldwide.";
    icon = Crosshair;
    category = "conflict" as const;
    version = "1.0.0";
    private iconUrls: Record<string, string> = {};

    async initialize(_ctx: PluginContext): Promise<void> { }
    destroy(): void { }

    async fetch(_tr: TimeRange): Promise<GeoEntity[]> { return []; }

    getPollingInterval(): number { return 0; }

    getLayerConfig(): LayerConfig {
        return { color: "#ef4444", clusterEnabled: false, clusterDistance: 0 };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const score = (entity.properties.escalationScore as number) || 3;
        const color = severityToColor(score);
        if (!this.iconUrls[color]) {
            this.iconUrls[color] = createSvgIconUrl(Crosshair, { color });
        }
        return { type: "billboard", iconUrl: this.iconUrls[color], color };
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            {
                id: "severity", label: "Severity", type: "select", propertyKey: "escalationScore",
                options: [
                    { value: "5", label: "Critical" },
                    { value: "4", label: "High Tension" },
                    { value: "3", label: "Elevated" },
                    { value: "2", label: "Watchlist" },
                ],
            },
            {
                id: "trend", label: "Trend", type: "select", propertyKey: "escalationTrend",
                options: [
                    { value: "escalating", label: "Escalating" },
                    { value: "stable", label: "Stable" },
                    { value: "de-escalating", label: "De-escalating" },
                ],
            },
        ];
    }
    
    getGlobeComponent() {
        return ConflictZonesRenderer;
    }
}


import { Shield } from "lucide-react";
import type {
    WorldPlugin, GeoEntity, TimeRange, PluginContext,
    LayerConfig, CesiumEntityOptions, SelectionBehavior,
    ServerPluginConfig, FilterDefinition,
} from "@worldwideview/wwv-plugin-sdk";

interface AdsbFiAircraft {
    hex: string; flight?: string; r?: string; t?: string;
    lat?: number; lon?: number; alt_baro?: number | "ground";
    alt_geom?: number; gs?: number; track?: number; squawk?: string;
    dbFlags?: number; category?: string; emergency?: string;
    seen?: number; seen_pos?: number;
}

function militaryAltitudeToColor(altFeet: number | null): string {
    if (altFeet === null || altFeet <= 0) return "#39ff14";
    if (altFeet < 10000) return "#ff6f00";
    if (altFeet < 25000) return "#ff1744";
    if (altFeet < 40000) return "#ff4081";
    return "#ffea00";
}

function feetToMeters(feet: number): number { return feet * 0.3048; }

export class MilitaryPlugin implements WorldPlugin {
    id = "military-aviation";
    name = "Military Aviation";
    description = "Real-time military aircraft tracking via adsb.fi";
    icon = Shield;
    category = "aviation" as const;
    version = "1.0.0";
    private context: PluginContext | null = null;

    async initialize(ctx: PluginContext): Promise<void> { this.context = ctx; }
    destroy(): void { this.context = null; }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const res = await fetch("/api/military");
            if (!res.ok) throw new Error(`Military API returned ${res.status}`);
            const data = await res.json();
            if (!data.ac || !Array.isArray(data.ac)) return [];

            return data.ac
                .filter((ac: AdsbFiAircraft) => ac.lat != null && ac.lon != null)
                .map((ac: AdsbFiAircraft): GeoEntity => {
                    const altFeet = typeof ac.alt_baro === "number" ? ac.alt_baro : null;
                    const altMeters = altFeet !== null ? feetToMeters(altFeet) : null;
                    const isOnGround = ac.alt_baro === "ground";
                    return {
                        id: `military-aviation-${ac.hex}`, pluginId: "military-aviation",
                        latitude: ac.lat!, longitude: ac.lon!,
                        altitude: altMeters !== null ? altMeters * 10 : 0,
                        heading: ac.track ?? undefined, speed: ac.gs ?? undefined,
                        timestamp: new Date(),
                        label: ac.flight?.trim() || ac.r || ac.hex,
                        properties: { hex: ac.hex, callsign: ac.flight?.trim() || null, registration: ac.r || null, aircraft_type: ac.t || null, altitude_ft: altFeet, altitude_m: altMeters, ground_speed_kts: ac.gs ?? null, heading: ac.track ?? null, squawk: ac.squawk || null, on_ground: isOnGround, category: ac.category || null, emergency: ac.emergency || null },
                    };
                });
        } catch (err) {
            console.error("[MilitaryPlugin] Fetch error:", err);
            return [];
        }
    }

    getPollingInterval(): number { return 60000; }
    getLayerConfig(): LayerConfig { return { color: "#ff6f00", clusterEnabled: true, clusterDistance: 40, maxEntities: 3000 }; }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const altFeet = entity.properties.altitude_ft as number | null;
        const isAirborne = !entity.properties.on_ground;
        return {
            type: "model", iconUrl: "/military-plane-icon.svg", size: isAirborne ? 8 : 5,
            modelUrl: "/airplane/scene.gltf", modelScale: 75, modelMinPixelSize: 16, modelHeadingOffset: 180,
            color: militaryAltitudeToColor(altFeet), rotation: entity.heading,
            labelText: entity.label || undefined, labelFont: "11px JetBrains Mono, monospace",
        };
    }

    getSelectionBehavior(entity: GeoEntity): SelectionBehavior | null {
        if (entity.properties.on_ground) return null;
        return { showTrail: true, trailDurationSec: 60, trailStepSec: 5, trailColor: "#ffea00", flyToOffsetMultiplier: 3, flyToBaseDistance: 30000 };
    }

    getServerConfig(): ServerPluginConfig {
        return { apiBasePath: "/api/military", pollingIntervalMs: 60000, requiresAuth: false };
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            { id: "aircraft_type", label: "Aircraft Type", type: "text", propertyKey: "aircraft_type" },
            { id: "callsign", label: "Callsign", type: "text", propertyKey: "callsign" },
            { id: "registration", label: "Registration", type: "text", propertyKey: "registration" },
            { id: "altitude", label: "Altitude (ft)", type: "range", propertyKey: "altitude_ft", range: { min: 0, max: 60000, step: 1000 } },
            { id: "on_ground", label: "On Ground", type: "boolean", propertyKey: "on_ground" },
        ];
    }

    getLegend(): { label: string; color: string; filterId?: string; filterValue?: string }[] {
        return [
            { label: "0 ft (Surface)", color: "#39ff14" },
            { label: "< 10,000 ft", color: "#ff6f00" },
            { label: "10,000 - 25,000 ft", color: "#ff1744" },
            { label: "25,000 - 40,000 ft", color: "#ff4081" },
            { label: "> 40,000 ft", color: "#ffea00" },
        ];
    }
}

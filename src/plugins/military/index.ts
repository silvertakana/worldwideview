import { Shield } from "lucide-react";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
    SelectionBehavior,
    ServerPluginConfig,
    FilterDefinition,
} from "@/core/plugins/PluginTypes";

interface AdsbFiAircraft {
    hex: string;
    flight?: string;
    r?: string;
    t?: string;
    lat?: number;
    lon?: number;
    alt_baro?: number | "ground";
    alt_geom?: number;
    gs?: number;
    track?: number;
    squawk?: string;
    dbFlags?: number;
    category?: string;
    emergency?: string;
    seen?: number;
    seen_pos?: number;
}

function militaryAltitudeToColor(altFeet: number | null): string {
    if (altFeet === null || altFeet <= 0) return "#6b8e23"; // olive — ground
    if (altFeet < 10000) return "#8fbc8f";   // dark sea green — low
    if (altFeet < 25000) return "#daa520";   // goldenrod — medium
    if (altFeet < 40000) return "#cd853f";   // peru — high
    return "#b22222";                         // firebrick — very high
}

function feetToMeters(feet: number): number {
    return feet * 0.3048;
}

export class MilitaryPlugin implements WorldPlugin {
    id = "military";
    name = "Military Aviation";
    description = "Real-time military aircraft tracking via adsb.fi";
    icon = Shield;
    category = "aviation" as const;
    version = "1.0.0";

    private context: PluginContext | null = null;

    async initialize(ctx: PluginContext): Promise<void> {
        this.context = ctx;
    }

    destroy(): void {
        this.context = null;
    }

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
                        id: `military-${ac.hex}`,
                        pluginId: "military",
                        latitude: ac.lat!,
                        longitude: ac.lon!,
                        altitude: altMeters !== null ? altMeters * 10 : 0,
                        heading: ac.track ?? undefined,
                        speed: ac.gs ?? undefined,
                        timestamp: new Date(),
                        label: ac.flight?.trim() || ac.r || ac.hex,
                        properties: {
                            hex: ac.hex,
                            callsign: ac.flight?.trim() || null,
                            registration: ac.r || null,
                            aircraft_type: ac.t || null,
                            altitude_ft: altFeet,
                            altitude_m: altMeters,
                            ground_speed_kts: ac.gs ?? null,
                            heading: ac.track ?? null,
                            squawk: ac.squawk || null,
                            on_ground: isOnGround,
                            category: ac.category || null,
                            emergency: ac.emergency || null,
                        },
                    };
                });
        } catch (err) {
            console.error("[MilitaryPlugin] Fetch error:", err);
            return [];
        }
    }

    getPollingInterval(): number {
        return 60000; // 60 seconds
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#6b8e23",
            clusterEnabled: true,
            clusterDistance: 40,
            maxEntities: 3000,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const altFeet = entity.properties.altitude_ft as number | null;
        const isAirborne = !entity.properties.on_ground;
        return {
            type: "model",
            iconUrl: "/military-plane-icon.svg",
            size: isAirborne ? 8 : 5,
            modelUrl: "/airplane/scene.gltf",
            modelScale: 75,
            modelMinPixelSize: 16,
            modelHeadingOffset: 180,
            color: militaryAltitudeToColor(altFeet),
            rotation: entity.heading,
            labelText: entity.label || undefined,
            labelFont: "11px JetBrains Mono, monospace",
        };
    }

    getSelectionBehavior(entity: GeoEntity): SelectionBehavior | null {
        const isAirborne = !entity.properties.on_ground;
        if (!isAirborne) return null;
        return {
            showTrail: true,
            trailDurationSec: 60,
            trailStepSec: 5,
            trailColor: "#daa520",
            flyToOffsetMultiplier: 3,
            flyToBaseDistance: 30000,
        };
    }

    getServerConfig(): ServerPluginConfig {
        return {
            apiBasePath: "/api/military",
            pollingIntervalMs: 60000,
            requiresAuth: false,
        };
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            {
                id: "aircraft_type",
                label: "Aircraft Type",
                type: "text",
                propertyKey: "aircraft_type",
            },
            {
                id: "callsign",
                label: "Callsign",
                type: "text",
                propertyKey: "callsign",
            },
            {
                id: "registration",
                label: "Registration",
                type: "text",
                propertyKey: "registration",
            },
            {
                id: "altitude",
                label: "Altitude (ft)",
                type: "range",
                propertyKey: "altitude_ft",
                range: { min: 0, max: 60000, step: 1000 },
            },
            {
                id: "on_ground",
                label: "On Ground",
                type: "boolean",
                propertyKey: "on_ground",
            },
        ];
    }
}

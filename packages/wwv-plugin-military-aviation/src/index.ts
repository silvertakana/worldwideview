import { Shield } from "lucide-react";
import type {
    GeoEntity, TimeRange,
    ServerPluginConfig, FilterDefinition,
} from "@worldwideview/wwv-plugin-sdk";
import { BaseAviationPlugin } from "@worldwideview/wwv-lib-aviation";

interface AdsbFiAircraft {
    hex: string; flight?: string; r?: string; t?: string;
    lat?: number; lon?: number; alt_baro?: number | "ground";
    alt_geom?: number; gs?: number; track?: number; squawk?: string;
    dbFlags?: number; category?: string; emergency?: string;
    seen?: number; seen_pos?: number; history?: any[];
}

function feetToMeters(feet: number): number { return feet * 0.3048; }

export class MilitaryPlugin extends BaseAviationPlugin {
    id = "military-aviation";
    name = "Military Aviation";
    description = "Real-time military aircraft tracking via adsb.lol";
    icon = Shield;
    version = "1.0.4";

    protected defaultLayerColor = "#ff6f00";
    protected defaultTrailColor = "#ffea00";
    protected iconUrl = "/military-plane-icon.svg";

    protected getAltitudeColor(altitudeMeters: number | null): string {
        // Convert back to feet for military altitude bands
        const altFeet = altitudeMeters !== null ? altitudeMeters / 0.3048 : null;
        if (altFeet === null || altFeet <= 0) return "#39ff14";
        if (altFeet < 10000) return "#ff6f00";
        if (altFeet < 25000) return "#ff1744";
        if (altFeet < 40000) return "#ff4081";
        return "#ffea00";
    }

    private mapPayloadToEntities(payloadData: any): GeoEntity[] {
        let aircraftList: any[] = [];
        if (Array.isArray(payloadData)) {
            aircraftList = payloadData;
        } else if (payloadData && typeof payloadData === 'object') {
            aircraftList = Object.values(payloadData);
        } else {
            return [];
        }

        return aircraftList
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
                    properties: { 
                        hex: ac.hex, callsign: ac.flight?.trim() || null, 
                        registration: ac.r || null, aircraft_type: ac.t || null, 
                        altitude_ft: altFeet, altitude_m: altMeters, ground_speed_kts: ac.gs ?? null, 
                        heading: ac.track ?? null, squawk: ac.squawk || null, 
                        on_ground: isOnGround, category: ac.category || null, 
                        emergency: ac.emergency || null,
                        history: ac.history || []
                    },
                };
            });
    }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const engineBase = process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL
                ? process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL.replace(/\/stream$/, '').replace(/^ws/, 'http')
                : 'http://localhost:5001';
            const res = await globalThis.fetch(`${engineBase}/data/military-aviation`);
            if (!res.ok) throw new Error(`Military API returned ${res.status}`);
            const data = await res.json();
            const aircraftList = data.ac || data.items;
            return this.mapPayloadToEntities(aircraftList);
        } catch (err: any) {
            console.error("[MilitaryPlugin] Fetch error:", err);
            if (this.context?.onError) this.context.onError(err);
            return [];
        }
    }

    mapWebsocketPayload(payload: any): GeoEntity[] {
        return this.mapPayloadToEntities(payload);
    }

    getServerConfig(): ServerPluginConfig {
        return { apiBasePath: "/api/military-aviation", pollingIntervalMs: 0, historyEnabled: true };
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

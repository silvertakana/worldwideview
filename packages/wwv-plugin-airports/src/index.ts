import { PlaneTakeoff } from "lucide-react";
import { BaseFacilityPlugin } from "@worldwideview/wwv-lib-facilities";
import type { GeoEntity, TimeRange } from "@worldwideview/wwv-plugin-sdk";

export class AirportsPlugin extends BaseFacilityPlugin {
    id = "airports";
    name = "Airports";
    description = "Airports and aerodromes worldwide from OSM";
    icon = PlaneTakeoff;
    category = "aviation" as const;
    version = "1.0.1";
    
    protected defaultLayerColor = "#3b82f6";
    protected iconScale = 0.5;

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const res = await fetch("/data/airports.geojson");
            if (!res.ok) throw new Error("Failed to load geojson");
            const parse = await res.json();
            
            if (!parse || !parse.features) return [];
            
            return parse.features.map((feat: any, i: number): GeoEntity => {
                const coords = feat.geometry?.coordinates;
                const lat = coords?.[1] ?? 0;
                const lon = coords?.[0] ?? 0;
                
                return {
                    id: `airports-${feat.id || i}`,
                    pluginId: this.id,
                    latitude: lat,
                    longitude: lon,
                    altitude: 0,
                    timestamp: new Date(),
                    label: feat.properties?.name || "Unknown Airport",
                    properties: feat.properties || {}
                }
            });
        } catch (e) {
            console.error("AirportsPlugin bundle fetch error:", e);
            return [];
        }
    }
}

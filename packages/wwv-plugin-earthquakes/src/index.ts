import { Activity } from "lucide-react";
import {
    type GeoEntity,
    type TimeRange,
    type FilterDefinition,
    type ServerPluginConfig,
} from "@worldwideview/wwv-plugin-sdk";
import { BaseIncidentPlugin } from "@worldwideview/wwv-lib-incidents";

export class EarthquakesPlugin extends BaseIncidentPlugin {
    id = "earthquakes";
    name = "Earthquakes";
    description = "Recent seismic activity from USGS";
    icon = Activity;
    category = "natural-disaster" as const;
    version = "1.1.0";
    protected defaultLayerColor = "#f97316";

    protected getSeverityValue(entity: GeoEntity): number {
        return Number(entity.properties.magnitude ?? 0) || 0;
    }

    protected getSeverityColor(mag: number): string {
        if (mag < 5.0) return "#fcd34d"; // Yellow
        if (mag < 6.0) return "#f97316"; // Orange
        if (mag < 7.0) return "#ef4444"; // Red
        return "#7f1d1d"; // Dark Red
    }

    protected getSeveritySize(mag: number): number {
        if (mag < 5.0) return 5;
        if (mag < 6.0) return 8;
        if (mag < 7.0) return 12;
        return 16;
    }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const engineBase = process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL
                ? process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL.replace(/\/stream$/, '').replace(/^ws/, 'http')
                : 'http://localhost:5001';
            const res = await globalThis.fetch(`${engineBase}/data/earthquake`);
            if (!res.ok) {
                this.context?.onError(new Error(`Earthquakes API returned ${res.status}`));
                return [];
            }

            const data = await res.json();
            const features = Array.isArray(data?.features) ? data.features : [];

            return features.flatMap((feature: any): GeoEntity[] => {
                const coordinates = feature?.geometry?.coordinates;
                const time = feature?.properties?.time;
                if (
                    !Array.isArray(coordinates)
                    || coordinates.length < 2
                    || !Number.isFinite(coordinates[0])
                    || !Number.isFinite(coordinates[1])
                    || !Number.isFinite(time)
                ) {
                    return [];
                }

                const magnitude = Number(feature?.properties?.mag ?? 0) || 0;
                return [{
                    id: `${this.id}-${feature.id}`,
                    pluginId: this.id,
                    latitude: coordinates[1],
                    longitude: coordinates[0],
                    altitude: 0,
                    timestamp: new Date(time),
                    label: `M${feature?.properties?.mag ?? "?"}`,
                    properties: {
                        magnitude,
                        depth: Number(feature?.geometry?.coordinates?.[2] ?? 0) || 0,
                        place: feature?.properties?.place ?? null,
                        url: feature?.properties?.url ?? null,
                        updated: feature?.properties?.updated ?? null,
                        status: feature?.properties?.status ?? null,
                        tsunami: feature?.properties?.tsunami ?? null,
                        sig: feature?.properties?.sig ?? null,
                        magType: feature?.properties?.magType ?? null,
                    },
                }];
            });
        } catch (err) {
            const error = err instanceof Error ? err : new Error("Failed to fetch earthquakes");
            this.context?.onError(error);
            return [];
        }
    }

    getPollingInterval(): number {
        return 120000;
    }

    getServerConfig(): ServerPluginConfig {
        return { apiBasePath: "/api/earthquake", pollingIntervalMs: 120000, historyEnabled: false };
    }

    getLayerConfig() {
        return {
            color: "#ef4444",
            clusterEnabled: true,
            clusterDistance: 40,
            maxEntities: 2000,
        };
    }

    renderEntity(entity: GeoEntity) {
        const magnitude = this.getSeverityValue(entity);
        return {
            type: "point" as const,
            color: this.getSeverityColor(magnitude),
            size: this.getSeveritySize(magnitude),
            outlineColor: "#000000",
            outlineWidth: 1,
            labelText: entity.label,
        };
    }

    getLegend(): { label: string; color: string; filterId?: string; filterValue?: string }[] {
        return [
            { label: "M < 5.0", color: "#fcd34d", filterId: "magnitude", filterValue: "0" },
            { label: "M 5.0 - 5.9", color: "#f97316", filterId: "magnitude", filterValue: "5.0" },
            { label: "M 6.0 - 6.9", color: "#ef4444", filterId: "magnitude", filterValue: "6.0" },
            { label: "M ≥ 7.0", color: "#7f1d1d", filterId: "magnitude", filterValue: "7.0" },
        ];
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            { id: "magnitude", label: "Magnitude", type: "range", propertyKey: "magnitude", range: { min: 0, max: 10, step: 0.1 } },
            { id: "depth", label: "Depth (km)", type: "range", propertyKey: "depth", range: { min: 0, max: 800, step: 10 } },
        ];
    }
}

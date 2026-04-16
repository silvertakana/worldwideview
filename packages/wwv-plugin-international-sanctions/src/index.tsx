import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Scale } from "lucide-react";
import { Color, PolygonHierarchy, GeoJsonDataSource, JulianDate } from "cesium";
import { Entity, PolygonGraphics } from "resium";
import {
    type WorldPlugin,
    type GeoEntity,
    type TimeRange,
    type PluginContext,
    type LayerConfig,
    type CesiumEntityOptions,
    type SelectionBehavior,
    type FilterDefinition,
    type ServerPluginConfig,
} from "@worldwideview/wwv-plugin-sdk";

const LEVEL_COLORS: Record<string, string> = {
    "low": "#facc15",    // Yellow
    "medium": "#f97316", // Orange
    "high": "#ef4444",   // Red
};

/** Attach _wwvEntity to a Resium Entity ref so InteractionHandler can pick it. */
function bindWwvEntity(ref: any, geoEntity: GeoEntity): void {
    const cesiumEntity = ref?.cesiumElement;
    if (cesiumEntity && !cesiumEntity._wwvEntity) {
        cesiumEntity._wwvEntity = geoEntity;
    }
}

export class InternationalSanctionsPlugin implements WorldPlugin {
    id = "international-sanctions";
    name = "International Sanctions";
    description = "Countries facing significant international US OFAC sanctions";
    icon = Scale;
    category = "economic" as const;
    version = "1.0.0";

    private context: PluginContext | null = null;
    private data: GeoEntity[] = [];

    async initialize(ctx: PluginContext): Promise<void> {
        this.context = ctx;
    }

    destroy(): void {
        this.context = null;
    }

    async fetch(timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const engineBase = process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL
                ? process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL.replace(/\/stream$/, '').replace(/^ws/, 'http')
                : 'http://localhost:5001';
            const res = await globalThis.fetch(`${engineBase}/data/sanctions?start=${timeRange.start.toISOString()}&end=${timeRange.end.toISOString()}`);
            if (!res.ok) throw new Error(`Sanctions API returned ${res.status}`);
            
            const data = await res.json();
            const sanctions = data.items || [];

            this.data = sanctions.map((s: any): GeoEntity => ({
                id: s.id,
                pluginId: this.id,
                latitude: s.latitude,
                longitude: s.longitude,
                altitude: 0,
                timestamp: new Date(s.timestamp),
                properties: { ...s },
            }));

            return this.data;
        } catch (err) {
            console.error(`[${this.name}] Fetch error:`, err);
            return [];
        }
    }

    getPollingInterval(): number {
        return 60000;
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#ef4444",
            clusterEnabled: false,
            clusterDistance: 0,
            disableDefaultRendering: true, // We use GlobeComp instead
            maxEntities: 5000,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        return { type: "point", size: 0, color: "transparent" };
    }

    getSelectionBehavior(entity: GeoEntity): SelectionBehavior | null {
        return {
            showTrail: false,
            flyToOffsetMultiplier: 2,
            flyToBaseDistance: 5000000,
        };
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            {
                id: "level",
                label: "Sanction Level",
                type: "select",
                propertyKey: "level",
                options: [
                    { value: "low", label: "Low (< 50)" },
                    { value: "medium", label: "Medium (50 - 500)" },
                    { value: "high", label: "High (> 500)" },
                ]
            }
        ];
    }

    getLegend() {
        return [
            { label: "High (> 500)", color: LEVEL_COLORS.high, filterId: "level", filterValue: "high" },
            { label: "Medium (50 - 500)", color: LEVEL_COLORS.medium, filterId: "level", filterValue: "medium" },
            { label: "Low (< 50)", color: LEVEL_COLORS.low, filterId: "level", filterValue: "low" },
        ];
    }

    getServerConfig(): ServerPluginConfig {
        return {
            apiBasePath: "/api/sanctions",
            pollingIntervalMs: 60000 * 60,
            historyEnabled: false,
        };
    }

    private GlobeComp = ({ enabled }: { enabled: boolean }) => {
        const [countryPolygons, setCountryPolygons] = useState<Record<string, PolygonHierarchy[]>>({});

        useEffect(() => {
            if (!enabled) return;
            
            let isSubscribed = true;
            async function loadGeoJson() {
                try {
                    const ds = new GeoJsonDataSource("border-shapes");
                    await ds.load("/borders.geojson");
                    if (!isSubscribed) return;

                    const now = JulianDate.now();
                    const polyMap: Record<string, PolygonHierarchy[]> = {};

                    for (const ent of ds.entities.values) {
                         const props = ent.properties ? ent.properties.getValue(now) : undefined;
                         const iso2 = props?.iso_a2; 
                         if (!iso2) continue;
                         
                         let hierarchy;
                         if (ent.polygon) {
                             hierarchy = ent.polygon.hierarchy?.getValue(now);
                         } 

                         if (hierarchy) {
                             if (!polyMap[iso2]) polyMap[iso2] = [];
                             polyMap[iso2].push(hierarchy);
                         } 
                    }
                    setCountryPolygons(polyMap);
                } catch(e) {
                    console.error("Failed to load borders for sanctions", e);
                }
            }
            loadGeoJson();
            return () => { isSubscribed = false; };
        }, [enabled]);

        const elements = useMemo(() => {
             if (!enabled || Object.keys(countryPolygons).length === 0 || this.data.length === 0) return [];
             const results: Array<{
                 id: string; name: string; geoEntity: GeoEntity;
                 color: Color; outlineColor: Color; height: number;
                 hierarchies: PolygonHierarchy[];
             }> = [];
             for (const entity of this.data) {
                 const code = entity.properties.countryCode as string;
                 const level = (entity.properties.level as string) || "low";
                 const hexStr = LEVEL_COLORS[level] || LEVEL_COLORS["low"];
                 const color = Color.fromCssColorString(hexStr).withAlpha(0.65);
                 const outlineColor = Color.fromCssColorString(hexStr).withAlpha(1.0);
                 const height = level === 'high' ? 250000 : (level === 'medium' ? 150000 : 75000);

                 const hierarchies = countryPolygons[code];
                 if (!hierarchies) continue;

                 results.push({
                     id: entity.id,
                     name: `Sanctioned Country: ${code}`,
                     geoEntity: entity,
                     color,
                     outlineColor,
                     height,
                     hierarchies
                 });
             }
             return results;
        }, [enabled, this.data, countryPolygons]);

        if (elements.length === 0) return null;

        return (
            <>
                {elements.flatMap((rc) => 
                    rc.hierarchies.map((hier: PolygonHierarchy, idx: number) => (
                        <Entity
                            key={`${rc.id}-${idx}`}
                            name={rc.name}
                            ref={(ref: any) => bindWwvEntity(ref, rc.geoEntity)}
                        >
                            <PolygonGraphics
                                hierarchy={hier}
                                extrudedHeight={rc.height}
                                height={0}
                                material={rc.color}
                                outline={true}
                                outlineColor={rc.outlineColor}
                                closeTop={true}
                                closeBottom={false}
                            />
                        </Entity>
                    ))
                )}
            </>
        );
    }

    getGlobeComponent() {
        return this.GlobeComp;
    }
}

import React, { useEffect } from "react";
import { SatelliteDish } from "lucide-react";
import { Color, Cartesian3, PolygonHierarchy } from "cesium";
import { Entity, PolygonGraphics } from "resium";
import { latLngToCell, cellToBoundary, cellToLatLng } from "h3-js";
import {
    type WorldPlugin,
    type GeoEntity,
    type TimeRange,
    type PluginContext,
    type LayerConfig,
    type CesiumEntityOptions,
    type FilterDefinition,
    type ServerPluginConfig
} from "@worldwideview/wwv-plugin-sdk";

const LEVEL_COLORS: Record<string, string> = {
    "low": "#facc15",    // Yellow
    "medium": "#f97316", // Orange
    "high": "#ef4444",   // Red
};

export class GpsJammingPlugin implements WorldPlugin {
    id = "gps_jamming";
    name = "GPS Jamming";
    description = "Daily Global GPS/GNSS Interference Map";
    icon = SatelliteDish;
    category = "aviation" as const;
    version = "1.0.0";
    
    private data: GeoEntity[] = [];

    private renderCache: Array<{
        id: string;
        name: string;
        description: string;
        height: number;
        color: Color;
        outlineColor: Color;
        hierarchy: PolygonHierarchy;
    }> = [];

    async initialize(_ctx: PluginContext): Promise<void> { }
    destroy(): void { }

    getServerConfig(): ServerPluginConfig {
        return {
            apiBasePath: "/api/gps_jamming",
            pollingIntervalMs: 3600 * 1000,
            requiresAuth: false,
            historyEnabled: false,
            availabilityEnabled: true
        };
    }

    async fetch(timeRange: TimeRange): Promise<GeoEntity[]> {
        const engineBase = process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL
            ? process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL.replace(/\/stream$/, '').replace(/^ws/, 'http')
            : 'http://localhost:5001';
        const res = await fetch(`${engineBase}/data/gps_jamming`);
        const json = await res.json();
        const items = json.items || [];
        
        const cellMap = new Map<string, { count: number, highest: number, region: string }>();
        const levelScore = { "low": 1, "medium": 2, "high": 3 };
        
        for (const item of items) {
             const cell = latLngToCell(item.lat, item.lon, 3);
             const score = levelScore[item.interferenceLevel as keyof typeof levelScore] || 1;
             
             if (!cellMap.has(cell)) {
                 cellMap.set(cell, { count: 1, highest: score, region: item.region });
             } else {
                 const current = cellMap.get(cell)!;
                 current.count++;
                 if (score > current.highest) current.highest = score;
             }
        }
        
        const scoreNames: Record<number, string> = { 1: "low", 2: "medium", 3: "high" };
        
        this.data = Array.from(cellMap.entries()).map(([cell, info]) => {
            const boundary = cellToBoundary(cell);
            const polygonHierarchy = boundary.flatMap(coord => [coord[1], coord[0]]); // [lon, lat]
            const [lat, lon] = cellToLatLng(cell);
            
            return {
                id: `h3_${cell}`,
                pluginId: this.id,
                latitude: lat,
                longitude: lon,
                timestamp: new Date(),
                properties: {
                    h3Boundary: polygonHierarchy,
                    interferenceLevel: scoreNames[info.highest],
                    region: info.region,
                    density: info.count
                }
            };
        });
        
        // Cache computationally expensive Cesium parameters to prevent Resium unmount/flicker
        this.renderCache = this.data.map(entity => {
            const level = (entity.properties?.interferenceLevel as string)?.toLowerCase() || "low";
            const hexStr = LEVEL_COLORS[level] || LEVEL_COLORS["low"];
            const color = Color.fromCssColorString(hexStr).withAlpha(0.65);
            const outlineColor = Color.fromCssColorString(hexStr).withAlpha(1.0);
            const height = level === 'high' ? 250000 : (level === 'medium' ? 150000 : 75000);
            const boundaryArray = entity.properties?.h3Boundary as number[] || [];
            
            return {
                id: entity.id,
                name: `GPS Interference: ${level.toUpperCase()}`,
                description: `
                    <div class="p-3">
                        <div class="mb-2"><span class="font-semibold text-gray-300">Level:</span> <span style="color: ${hexStr}">${level.toUpperCase()}</span></div>
                        <div class="mb-2"><span class="font-semibold text-gray-300">Region:</span> ${entity.properties?.region || 'Unknown'}</div>
                        <div class="mb-2"><span class="font-semibold text-gray-300">Reports:</span> ${entity.properties?.density}</div>
                    </div>
                `,
                height,
                color,
                outlineColor,
                hierarchy: new PolygonHierarchy(Cartesian3.fromDegreesArray(boundaryArray))
            };
        });
        
        return this.data;
    }

    getPollingInterval(): number { 
        return 3600 * 1000;
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#ef4444",
            clusterEnabled: false,
            clusterDistance: 50,
            disableDefaultRendering: true,
        };
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            {
                id: "level",
                label: "Interference Level",
                propertyKey: "interferenceLevel",
                type: "select",
                options: [
                    { value: "low", label: "Low (0-2%)" },
                    { value: "medium", label: "Medium (2-10%)" },
                    { value: "high", label: "High (>10%)" }
                ]
            }
        ];
    }

    getLegend() {
        return [
            { label: "Low (0-2%)", color: LEVEL_COLORS["low"], filterId: "level", filterValue: "low" },
            { label: "Medium (2-10%)", color: LEVEL_COLORS["medium"], filterId: "level", filterValue: "medium" },
            { label: "High (>10%)", color: LEVEL_COLORS["high"], filterId: "level", filterValue: "high" }
        ];
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        return { type: "point", size: 0, color: "transparent" };
    }

    private GlobeComp = ({ enabled }: { enabled: boolean }) => {
        if (!enabled || this.renderCache.length === 0) return null;

        return (
            <>
                {this.renderCache.map((rc) => (
                    <Entity
                        key={rc.id}
                        name={rc.name}
                        description={rc.description}
                    >
                        <PolygonGraphics
                            hierarchy={rc.hierarchy}
                            extrudedHeight={rc.height}
                            height={0}
                            material={rc.color}
                            outline={true}
                            outlineColor={rc.outlineColor}
                            closeTop={true}
                            closeBottom={false}
                        />
                    </Entity>
                ))}
            </>
        );
    };

    getGlobeComponent() {
        return this.GlobeComp;
    }
}

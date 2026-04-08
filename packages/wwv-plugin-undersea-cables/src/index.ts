import React, { useEffect, useRef } from "react";
import { Cable } from "lucide-react";
import * as Cesium from "cesium";
import type {
    GlobePlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
} from "@worldwideview/wwv-plugin-sdk";

const UnderseaCablesRenderer: React.FC<{ viewer: Cesium.Viewer | null; enabled: boolean }> = ({ viewer, enabled }) => {
    const dataSourceRef = useRef<Cesium.CustomDataSource | null>(null);

    useEffect(() => {
        if (!viewer || !enabled) {
            // Cleanup on disable
            if (viewer && !viewer.isDestroyed() && viewer.dataSources && dataSourceRef.current) {
                viewer.dataSources.remove(dataSourceRef.current);
                dataSourceRef.current = null;
            }
            return;
        }

        let isCancelled = false;

        async function loadCables() {
            if (!viewer) return;
            try {
                const activeDataSource = new Cesium.CustomDataSource("undersea-cables");
                viewer.dataSources.add(activeDataSource);
                dataSourceRef.current = activeDataSource;
                
                // Proxy route to bypass CORS for Telegeography submarine cable map API
                const url = "/api/undersea-cables";
                
                const tempDataSource = new Cesium.GeoJsonDataSource("temp-parse");
                await tempDataSource.load(url);

                if (isCancelled) return;

                const parsedEntities = [...tempDataSource.entities.values];
                const lineColor = Cesium.Color.fromCssColorString("#0ea5e9").withAlpha(0.6);
                
                let i = 0;
                const CHUNK_SIZE = 50;

                function processChunk() {
                    if (isCancelled || !viewer) return;
                    
                    activeDataSource.entities.suspendEvents();
                    
                    const chunkLimit = Math.min(i + CHUNK_SIZE, parsedEntities.length);
                    for (; i < chunkLimit; i++) {
                        const entity = parsedEntities[i];
                        tempDataSource.entities.remove(entity);
                        
                        if (entity.polyline) {
                            entity.polyline.width = new Cesium.ConstantProperty(2);
                            entity.polyline.material = new Cesium.ColorMaterialProperty(lineColor);
                            entity.polyline.clampToGround = new Cesium.ConstantProperty(false);
                            
                            const posProperty = entity.polyline.positions;
                            if (posProperty) {
                                const positions = typeof posProperty.getValue === "function" ? posProperty.getValue(Cesium.JulianDate.now()) : posProperty;
                                if (positions && Array.isArray(positions)) {
                                    const raisedPositions = positions.map((pos: any) => {
                                        const carto = Cesium.Cartographic.fromCartesian(pos);
                                        carto.height += 2500; // Raise by 2.5km to prevent low-res Earth geometry clipping
                                        return Cesium.Cartographic.toCartesian(carto);
                                    });
                                    entity.polyline.positions = new Cesium.ConstantProperty(raisedPositions);
                                }
                            }
                        }
                        const props = entity.properties ? entity.properties.getValue(Cesium.JulianDate.now()) : {};
                        let desc = `<table class="cesium-infoBox-defaultTable"><tbody>`;
                        for (const key in props) {
                            if (props.hasOwnProperty(key)) {
                                desc += `<tr><th>${key}</th><td>${props[key]}</td></tr>`;
                            }
                        }
                        desc += `</tbody></table>`;
                        entity.description = new Cesium.ConstantProperty(desc);
                        
                        activeDataSource.entities.add(entity);
                    }
                    
                    activeDataSource.entities.resumeEvents();

                    if (i < parsedEntities.length) {
                        requestAnimationFrame(processChunk);
                    }
                }

                processChunk();
            } catch (err) {
                console.error("[UnderseaCablesPlugin] Failed to load data", err);
            }
        }

        loadCables();

        return () => {
            isCancelled = true;
            if (viewer && !viewer.isDestroyed() && viewer.dataSources && dataSourceRef.current) {
                viewer.dataSources.remove(dataSourceRef.current);
                dataSourceRef.current = null;
            }
        };
    }, [viewer, enabled]);

    return null; // Side-effect only component
};

export class UnderseaCablesPlugin implements GlobePlugin {
    id = "undersea-cables";
    name = "Undersea Cables";
    description = "Displays the global network of submarine telecommunication cables.";
    icon = Cable;
    category = "infrastructure" as const;
    version = "1.0.0";
    
    async initialize(_ctx: PluginContext): Promise<void> {}
    
    destroy(): void {}

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> { return []; }

    getPollingInterval(): number { return 0; }

    getLayerConfig(): LayerConfig {
        return { color: "#0ea5e9", clusterEnabled: false, clusterDistance: 0 };
    }

    renderEntity(_entity: GeoEntity): CesiumEntityOptions {
        return { type: "polyline" }; // Fallback since actual rendering is via GlobeComponent
    }

    getGlobeComponent() {
        return UnderseaCablesRenderer;
    }
}

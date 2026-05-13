"use client";

import { useEffect, useRef, useState } from "react";
import {
    Color,
    Cartesian3,
    PolygonHierarchy,
    LabelStyle,
    VerticalOrigin,
    HorizontalOrigin,
    NearFarScalar,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    BoundingSphere,
} from "cesium";
import { SectorCrimePanel } from "./SectorCrimePanel";

const SECTOR_GEOJSON_URL =
    "https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/APD_District_Rep_Subsectors_2025/FeatureServer/0/query?where=1%3D1&outFields=Subsector,Sector&f=geojson";

const SECTOR_NAME_TO_CODE: Record<string, string> = {
    Adam:    "AD",
    Baker:   "BA",
    Charlie: "CH",
    David:   "DA",
    Edward:  "ED",
    Frank:   "FR",
    George:  "GE",
    Henry:   "HE",
    Ida:     "ID",
};

const FILL         = Color.fromCssColorString("#a78bfa").withAlpha(0.18);
const FILL_SELECTED = Color.fromCssColorString("#a78bfa").withAlpha(0.45);
const OUTLINE      = Color.fromCssColorString("#a78bfa").withAlpha(1.0);
const LABEL_COLOR  = Color.fromCssColorString("#a78bfa");

export function SectorOverlayGlobe({ viewer, enabled }: { viewer: any; enabled: boolean }) {
    const entitiesRef = useRef<any[]>([]);
    const handlerRef  = useRef<ScreenSpaceEventHandler | null>(null);
    const selectedRef = useRef<any>(null);
    const [selectedSector, setSelectedSector] = useState<{ name: string; code: string } | null>(null);

    useEffect(() => {
        cleanup(viewer, entitiesRef, handlerRef);
        setSelectedSector(null);
        selectedRef.current = null;

        if (!viewer || !enabled) return;

        let cancelled = false;

        fetch(SECTOR_GEOJSON_URL)
            .then((r) => r.json())
            .then((geojson) => {
                if (cancelled || !viewer || viewer.isDestroyed?.()) return;

                for (const feature of geojson.features ?? []) {
                    const sectorName: string = feature.properties?.Sector ?? "";
                    const subsectorName: string = feature.properties?.Subsector ?? "";
                    const code = SECTOR_NAME_TO_CODE[sectorName] ?? sectorName.slice(0, 2).toUpperCase();

                    const rings: number[][][] =
                        feature.geometry?.type === "Polygon"
                            ? feature.geometry.coordinates
                            : feature.geometry?.type === "MultiPolygon"
                            ? feature.geometry.coordinates.flat()
                            : [];

                    if (!rings.length) continue;

                    const positions = rings[0].map(([lon, lat]: number[]) =>
                        Cartesian3.fromDegrees(lon, lat)
                    );

                    const center = BoundingSphere.fromPoints(positions).center;

                    const label = subsectorName
                        .replace(`${sectorName} Sector `, "")
                        .replace(`${sectorName} `, "")
                        .trim();

                    // Polygon fill
                    const poly = viewer.entities.add({
                        _sectorName: sectorName,
                        _sectorCode: code,
                        polygon: {
                            hierarchy: new PolygonHierarchy(positions),
                            material: FILL,
                            outline: false,
                        },
                    });

                    // Explicit polyline border (outlines on terrain entities don't render)
                    const border = viewer.entities.add({
                        _sectorName: sectorName,
                        _sectorCode: code,
                        polyline: {
                            positions: [...positions, positions[0]], // close the ring
                            width: 2,
                            material: OUTLINE,
                            clampToGround: true,
                        },
                    });

                    // Label
                    const labelEntity = viewer.entities.add({
                        position: center,
                        label: {
                            text: `${sectorName}\n${label}`,
                            font: "bold 11px JetBrains Mono, monospace",
                            fillColor: LABEL_COLOR,
                            outlineColor: Color.BLACK,
                            outlineWidth: 2,
                            style: LabelStyle.FILL_AND_OUTLINE,
                            verticalOrigin: VerticalOrigin.CENTER,
                            horizontalOrigin: HorizontalOrigin.CENTER,
                            disableDepthTestDistance: Number.POSITIVE_INFINITY,
                            translucencyByDistance: new NearFarScalar(3e4, 1.0, 4e5, 0.0),
                        },
                    });

                    entitiesRef.current.push(poly, border, labelEntity);
                }

                // Click handler
                const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
                handler.setInputAction((click: any) => {
                    const picked = viewer.scene.pick(click.position);

                    if (!picked?.id?._sectorName && !picked?.primitive?._sectorName) {
                        if (selectedRef.current) {
                            selectedRef.current.polygon.material = FILL;
                            selectedRef.current = null;
                        }
                        setSelectedSector(null);
                        return;
                    }

                    const entity = picked.id ?? picked.primitive;
                    if (selectedRef.current && selectedRef.current !== entity) {
                        selectedRef.current.polygon.material = FILL;
                    }
                    entity.polygon.material = FILL_SELECTED;
                    selectedRef.current = entity;
                    setSelectedSector({ name: entity._sectorName, code: entity._sectorCode });
                }, ScreenSpaceEventType.LEFT_CLICK);

                handlerRef.current = handler;
                viewer.scene.requestRender?.();
            })
            .catch(console.error);

        return () => {
            cancelled = true;
            cleanup(viewer, entitiesRef, handlerRef);
            setSelectedSector(null);
        };
    }, [viewer, enabled]);

    if (!selectedSector) return null;

    return (
        <SectorCrimePanel
            sectorName={selectedSector.name}
            sectorCode={selectedSector.code}
            onClose={() => {
                if (selectedRef.current) {
                    selectedRef.current.polygon.material = FILL;
                    selectedRef.current = null;
                }
                setSelectedSector(null);
            }}
        />
    );
}

function cleanup(
    viewer: any,
    entitiesRef: React.MutableRefObject<any[]>,
    handlerRef: React.MutableRefObject<ScreenSpaceEventHandler | null>,
) {
    handlerRef.current?.destroy();
    handlerRef.current = null;
    for (const e of entitiesRef.current) {
        try { viewer?.entities.remove(e); } catch { /* gone */ }
    }
    entitiesRef.current = [];
}

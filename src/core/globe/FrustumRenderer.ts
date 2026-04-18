/**
 * Manages Cesium Entity polylines for camera frustum outlines.
 *
 * Draws 4 side-edge lines from the camera apex to the 4 far
 * corners of the view pyramid. No far-plane rectangle is drawn
 * (it would clip the earth surface).
 *
 * Architecture: corners come from frustumGeometry.ts so a future
 * ground-projection step can replace the far-plane corners with
 * terrain-intersection points without changing this renderer.
 */

import {
    Cartesian3,
    Color,
    Entity,
    PolylineGlowMaterialProperty,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import type { GeoEntity } from "@worldwideview/wwv-plugin-sdk";
import {
    computeFrustumEdges,
    FRUSTUM_DEFAULTS,
    type FrustumEdges,
    type Point3D,
} from "./frustumGeometry";

const FRUSTUM_COLOR = Color.fromCssColorString("#00ccff").withAlpha(0.6);
const EDGE_WIDTH = 2;

export class FrustumRenderer {
    /** Map from entity id → array of 4 Cesium.Entity polylines */
    private entityMap = new Map<string, Entity[]>();

    /**
     * Sync frustum outlines with the current set of camera entities.
     * Only draws for entities whose `properties` include heading.
     */
    update(viewer: CesiumViewer, entities: GeoEntity[]): void {
        if (!viewer || viewer.isDestroyed()) return;
        const activeIds = new Set<string>();

        for (const geo of entities) {
            if (geo.pluginId !== "camera") continue;

            const heading = this.resolveHeading(geo);
            if (heading === undefined) continue;

            activeIds.add(geo.id);
            const edges = this.buildEdges(geo, heading);

            if (this.entityMap.has(geo.id)) {
                this.updateExisting(viewer, geo.id, edges);
            } else {
                this.createNew(viewer, geo.id, edges);
            }
        }

        this.removeStale(viewer, activeIds);
    }

    /** Remove all frustum entities from the viewer. */
    clear(viewer: CesiumViewer): void {
        if (!viewer || viewer.isDestroyed()) {
            this.entityMap.clear();
            return;
        }
        for (const [, lines] of this.entityMap) {
            for (const line of lines) {
                viewer.entities.remove(line);
            }
        }
        this.entityMap.clear();
    }

    // ─── Private helpers ─────────────────────────────────────

    private resolveHeading(geo: GeoEntity): number | undefined {
        const p = geo.properties;
        if (typeof p.heading === "number") return p.heading;
        if (typeof p.azimuth === "number") return p.azimuth;
        if (typeof p.heading === "string") {
            return parseFloat(p.heading) || undefined;
        }
        return geo.heading;
    }

    private buildEdges(geo: GeoEntity, heading: number): FrustumEdges {
        const p = geo.properties;
        return computeFrustumEdges({
            lat: geo.latitude,
            lon: geo.longitude,
            alt: toNum(p.altitude, toNum(p.alt, FRUSTUM_DEFAULTS.alt)),
            headingDeg: heading,
            pitchDeg: toNum(p.pitch, FRUSTUM_DEFAULTS.pitchDeg),
            hFovDeg: toNum(p.fov, toNum(p.hFov, FRUSTUM_DEFAULTS.hFovDeg)),
            vFovDeg: toNum(p.vFov, FRUSTUM_DEFAULTS.vFovDeg),
            rangeMtrs: toNum(p.range, FRUSTUM_DEFAULTS.rangeMtrs),
        });
    }

    private createNew(viewer: CesiumViewer, id: string, edges: FrustumEdges): void {
        const corners = [edges.topLeft, edges.topRight, edges.bottomLeft, edges.bottomRight];
        const lines = corners.map((corner) =>
            this.addEdgeLine(viewer, id, edges.apex, corner),
        );
        this.entityMap.set(id, lines);
    }

    private updateExisting(viewer: CesiumViewer, id: string, edges: FrustumEdges): void {
        const corners = [edges.topLeft, edges.topRight, edges.bottomLeft, edges.bottomRight];
        const existing = this.entityMap.get(id)!;
        for (let i = 0; i < 4; i++) {
            existing[i].polyline!.positions = toPositions(edges.apex, corners[i]) as any;
        }
    }

    private removeStale(viewer: CesiumViewer, activeIds: Set<string>): void {
        for (const [id, lines] of this.entityMap) {
            if (!activeIds.has(id)) {
                for (const line of lines) viewer.entities.remove(line);
                this.entityMap.delete(id);
            }
        }
    }

    private addEdgeLine(
        viewer: CesiumViewer, parentId: string,
        from: Point3D, to: Point3D,
    ): Entity {
        return viewer.entities.add({
            id: `frustum-${parentId}-${Math.random().toString(36).slice(2, 8)}`,
            polyline: {
                positions: toPositions(from, to),
                width: EDGE_WIDTH,
                material: new PolylineGlowMaterialProperty({
                    glowPower: 0.15,
                    color: FRUSTUM_COLOR,
                }),
                clampToGround: false,
            },
        });
    }
}

// ─── Utilities ───────────────────────────────────────────────

function toPositions(a: Point3D, b: Point3D): Cartesian3[] {
    return [
        Cartesian3.fromDegrees(a.lon, a.lat, a.alt),
        Cartesian3.fromDegrees(b.lon, b.lat, b.alt),
    ];
}

function toNum(val: unknown, fallback: number): number {
    if (typeof val === "number" && !Number.isNaN(val)) return val;
    if (typeof val === "string") {
        const n = parseFloat(val);
        if (!Number.isNaN(n)) return n;
    }
    return fallback;
}

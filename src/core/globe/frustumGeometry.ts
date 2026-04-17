/**
 * Pure math for computing 3D camera frustum edges.
 * No Cesium dependency — fully unit-testable.
 *
 * The frustum is a pyramid with:
 *   - apex at the camera position
 *   - 4 corner rays extending outward at `range` meters
 *   - orientation defined by heading, pitch, and FOV
 *
 * Architecture note: returns raw corner positions so that
 * a future ground-projection step can raycast these rays
 * onto the terrain surface.
 */

const DEG2RAD = Math.PI / 180;
const EARTH_RADIUS = 6_371_000; // metres

// ─── Public types ────────────────────────────────────────────

export interface Point3D {
    lat: number;
    lon: number;
    alt: number;
}

/** The 4 far-plane corners + the apex, ready for rendering. */
export interface FrustumEdges {
    apex: Point3D;
    topLeft: Point3D;
    topRight: Point3D;
    bottomLeft: Point3D;
    bottomRight: Point3D;
}

export interface FrustumParams {
    lat: number;
    lon: number;
    alt: number;       // metres above ground
    headingDeg: number; // 0 = north, 90 = east
    pitchDeg: number;   // 0 = horizontal, negative = looking down
    hFovDeg: number;    // horizontal field of view
    vFovDeg: number;    // vertical field of view (or derived from aspect)
    rangeMtrs: number;  // max visible distance
}

// ─── Defaults ────────────────────────────────────────────────

export const FRUSTUM_DEFAULTS = {
    alt: 8,
    headingDeg: 0,
    pitchDeg: -10,
    hFovDeg: 50,
    vFovDeg: 35,
    rangeMtrs: 200,
} as const;

// ─── Core computation ────────────────────────────────────────

/**
 * Compute the 4 frustum corner points at `range` distance
 * from the camera, given orientation and FOV.
 *
 * Returns edges that can be drawn as 4 polylines from apex
 * to each corner, or passed to a ground-projection step.
 */
export function computeFrustumEdges(params: FrustumParams): FrustumEdges {
    const { lat, lon, alt, headingDeg, pitchDeg, hFovDeg, vFovDeg, rangeMtrs } = params;

    const apex: Point3D = { lat, lon, alt };

    const halfH = (hFovDeg / 2) * DEG2RAD;
    const halfV = (vFovDeg / 2) * DEG2RAD;
    const heading = headingDeg * DEG2RAD;
    const pitch = pitchDeg * DEG2RAD;

    // For each corner we compute horizontal bearing offset ± halfH
    // and vertical pitch offset ± halfV, then project to a destination.
    const corners: [number, number][] = [
        [-halfH, halfV],  // topLeft
        [halfH, halfV],   // topRight
        [-halfH, -halfV], // bottomLeft
        [halfH, -halfV],  // bottomRight
    ];

    const [topLeft, topRight, bottomLeft, bottomRight] = corners.map(
        ([hOff, vOff]) => projectCorner(lat, lon, alt, heading, pitch, hOff, vOff, rangeMtrs),
    );

    return { apex, topLeft, topRight, bottomLeft, bottomRight };
}

// ─── Cardinal direction helper ───────────────────────────────

const CARDINAL_MAP: Record<string, number> = {
    n: 0, north: 0, nb: 0, northbound: 0,
    ne: 45, northeast: 45, neb: 45,
    e: 90, east: 90, eb: 90, eastbound: 90,
    se: 135, southeast: 135, seb: 135,
    s: 180, south: 180, sb: 180, southbound: 180,
    sw: 225, southwest: 225, swb: 225,
    w: 270, west: 270, wb: 270, westbound: 270,
    nw: 315, northwest: 315, nwb: 315,
};

/**
 * Convert a cardinal direction string to degrees.
 * Returns `undefined` if not recognised.
 */
export function cardinalToHeading(dir: string): number | undefined {
    return CARDINAL_MAP[dir.trim().toLowerCase()];
}

// ─── Internal math ───────────────────────────────────────────

/**
 * Project a single frustum corner from the camera position.
 *
 * 1. Compute the bearing = heading + horizontal offset
 * 2. Compute the ground distance = range * cos(pitch + vOff)
 * 3. Compute the altitude delta = range * sin(pitch + vOff)
 * 4. Use haversine destination formula for the ground position
 */
function projectCorner(
    latDeg: number, lonDeg: number, altM: number,
    headingRad: number, pitchRad: number,
    hOffRad: number, vOffRad: number,
    range: number,
): Point3D {
    const bearing = headingRad + hOffRad;
    const elevation = pitchRad + vOffRad;

    const groundDist = range * Math.cos(elevation);
    const altDelta = range * Math.sin(elevation);

    const dest = destinationPoint(latDeg, lonDeg, Math.abs(groundDist), bearing);

    return {
        lat: dest.lat,
        lon: dest.lon,
        alt: Math.max(0, altM + altDelta),
    };
}

/**
 * Haversine destination point given start coords (deg),
 * distance (m), and bearing (rad).
 */
function destinationPoint(
    latDeg: number, lonDeg: number,
    distMetres: number, bearingRad: number,
): { lat: number; lon: number } {
    const lat1 = latDeg * DEG2RAD;
    const lon1 = lonDeg * DEG2RAD;
    const angularDist = distMetres / EARTH_RADIUS;

    const sinLat1 = Math.sin(lat1);
    const cosLat1 = Math.cos(lat1);
    const sinD = Math.sin(angularDist);
    const cosD = Math.cos(angularDist);

    const lat2 = Math.asin(
        sinLat1 * cosD + cosLat1 * sinD * Math.cos(bearingRad),
    );
    const lon2 = lon1 + Math.atan2(
        Math.sin(bearingRad) * sinD * cosLat1,
        cosD - sinLat1 * Math.sin(lat2),
    );

    return { lat: lat2 / DEG2RAD, lon: lon2 / DEG2RAD };
}

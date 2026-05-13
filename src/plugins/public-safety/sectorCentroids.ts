/**
 * Austin APD sector codes → approximate geographic centroid.
 * Sectors are used in the fdj4-gpfu crime dataset in place of GPS coords.
 * Centroids are derived from Austin PD patrol district map boundaries.
 *
 * Fallback: Austin city center (30.2672, -97.7431)
 */
export interface SectorCentroid {
    lat: number;
    lon: number;
    label: string;
}

export const SECTOR_CENTROIDS: Record<string, SectorCentroid> = {
    // District 1 — North/Central
    AP: { lat: 30.3677, lon: -97.7399, label: "North Austin (AP)" },
    FR: { lat: 30.3480, lon: -97.6990, label: "Northeast Austin (FR)" },
    HE: { lat: 30.4450, lon: -97.7200, label: "Far North Austin (HE)" },

    // District 2 — East
    BA: { lat: 30.2610, lon: -97.7050, label: "East Austin (BA)" },
    ED: { lat: 30.2250, lon: -97.7150, label: "Southeast Austin (ED)" },

    // District 3 — South
    DA: { lat: 30.2180, lon: -97.7650, label: "South Austin (DA)" },
    ID: { lat: 30.2400, lon: -97.7850, label: "Southwest Austin (ID)" },
    KI: { lat: 30.1900, lon: -97.7900, label: "Far South Austin (KI)" },

    // District 4 — West/Central
    AD: { lat: 30.3200, lon: -97.7700, label: "North/Central Austin (AD)" },
    CH: { lat: 30.2800, lon: -97.7550, label: "Central Austin (CH)" },
    GE: { lat: 30.2950, lon: -97.7800, label: "West Austin (GE)" },

    // Catch-all for codes seen in data but not mapped above
    UT: { lat: 30.2849, lon: -97.7341, label: "UT / Hyde Park (UT)" },
    CD: { lat: 30.2672, lon: -97.7431, label: "Downtown (CD)" },
};

export const AUSTIN_CENTER: SectorCentroid = {
    lat: 30.2672,
    lon: -97.7431,
    label: "Austin",
};

export function getSectorCentroid(sector: string): SectorCentroid {
    return SECTOR_CENTROIDS[sector.toUpperCase()] ?? AUSTIN_CENTER;
}

"use client";

// ─── Place Categories ────────────────────────────────────────
// Maps Google Places API type arrays to display categories with
// appropriate zoom distances for the camera.

export type PlaceCategory = "address" | "establishment" | "landmark" | "region";

interface ZoomParams {
    distance: number;
    maxPitch: number;
}

// ─── Type → Category Mapping ─────────────────────────────────
const ADDRESS_TYPES = new Set([
    "street_address", "route", "intersection", "premise",
    "subpremise", "street_number",
]);

const LANDMARK_TYPES = new Set([
    "point_of_interest", "natural_feature", "park", "tourist_attraction",
    "museum", "stadium", "amusement_park", "zoo", "aquarium",
]);

const ESTABLISHMENT_TYPES = new Set([
    "establishment", "school", "university", "hospital", "church",
    "airport", "train_station", "transit_station", "shopping_mall",
    "store", "restaurant", "lodging", "library", "bank",
    "local_government_office", "embassy",
]);

const REGION_TYPES = new Set([
    "locality", "sublocality", "administrative_area_level_1",
    "administrative_area_level_2", "country", "postal_code",
    "geocode", "political",
]);

/** Classify a Google Places `types[]` into a display category. */
export function categorizePlace(types: string[]): PlaceCategory {
    for (const t of types) {
        if (ADDRESS_TYPES.has(t)) return "address";
        if (LANDMARK_TYPES.has(t)) return "landmark";
        if (ESTABLISHMENT_TYPES.has(t)) return "establishment";
    }
    for (const t of types) {
        if (REGION_TYPES.has(t)) return "region";
    }
    // Default: treat unknown types as addresses (most specific)
    return "address";
}

// ─── Zoom Params ─────────────────────────────────────────────
const ZOOM_BY_CATEGORY: Record<PlaceCategory, ZoomParams> = {
    address: { distance: 1_000, maxPitch: -40 },
    establishment: { distance: 5_000, maxPitch: -45 },
    landmark: { distance: 5_000, maxPitch: -45 },
    region: { distance: 5_000_000, maxPitch: -70 },
};

const CITY_ZOOM: ZoomParams = { distance: 50_000, maxPitch: -50 };

/** Get appropriate camera zoom params based on the detail types. */
export function getZoomForTypes(types?: string[]): ZoomParams {
    if (!types || types.length === 0) {
        return ZOOM_BY_CATEGORY.region;
    }
    // Cities get a special mid-range zoom
    if (types.includes("locality")) return CITY_ZOOM;

    const category = categorizePlace(types);
    return ZOOM_BY_CATEGORY[category];
}

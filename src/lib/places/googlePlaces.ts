import crypto from "node:crypto";

/**
 * Places API (New) client for the globe's server-side search.
 *
 * The key travels in the X-Goog-Api-Key header and never in the query string, so it cannot
 * leak into a URL log or an upstream access record. Field masks are sent explicitly: the New
 * API returns only what is asked for, and an unknown path is rejected with INVALID_ARGUMENT.
 */

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places/";

const AUTOCOMPLETE_FIELD_MASK = [
    "suggestions.placePrediction.placeId",
    "suggestions.placePrediction.text",
    "suggestions.placePrediction.structuredFormat",
    "suggestions.placePrediction.types",
].join(",");

const DETAILS_FIELD_MASK = "id,displayName,formattedAddress,location,viewport,types";

const SEARCH_TEXT_FIELD_MASK =
    "places.id,places.displayName,places.formattedAddress,places.location,places.types";

/** Keys shorter than this are rejected before they reach Google; a real header key is 39 chars. */
const MIN_KEY_LENGTH = 20;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_SEARCH_RESULTS = 20;
const DEFAULT_SEARCH_RESULTS = 5;

/**
 * Conservative upper bound on a Places query string. This is NOT a documented Google
 * limit: as of 2026-10-05 neither the Text Search (New) guide, the searchText REST
 * reference, the Autocomplete (New) reference, the v1 Discovery document, nor
 * googleapis/google/maps/places/v1/places_service.proto states a maximum length for
 * `textQuery`/autocomplete `input` (the only documented string bound in that service is
 * sessionToken, 36 ASCII characters). The cap exists so one caller cannot push an
 * arbitrarily large string into a billed upstream call.
 */
export const MAX_PLACES_QUERY_LENGTH = 256;

export interface PlacePrediction {
    placeId: string;
    description: string;
    mainText: string;
    secondaryText: string;
    types: string[];
}

export interface LegacyViewport {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
}

export interface PlaceDetails {
    lat: number;
    lon: number;
    name: string;
    types: string[];
    /** Legacy bounds shape: getZoomForTypes() in placeCategories.ts reads northeast/southwest. */
    viewport: LegacyViewport | null;
}

export interface PlaceSearchResult {
    placeId: string;
    name: string;
    address: string;
    lat: number;
    lon: number;
    types: string[];
}

export interface ResolvedPlacesKey {
    key: string;
    source: "user" | "env";
}

/** Upstream failure carrying the terms a caller needs to answer with. */
export class PlacesError extends Error {
    readonly httpStatus: number;
    readonly googleStatus: string;

    constructor(httpStatus: number, googleStatus: string, message: string) {
        super(message);
        this.name = "PlacesError";
        this.httpStatus = httpStatus;
        this.googleStatus = googleStatus;
    }
}

/**
 * Stable per-key cache discriminator. Every Google key starts "AIzaSy", so the previous
 * first-8-chars prefix collided and could serve one user another user's cached results.
 */
export function placesKeyFingerprint(key: string): string {
    return crypto.createHash("sha256").update(key).digest("hex").slice(0, 12);
}

/** The caller's own key wins over the instance key; anything too short is not a key. */
export function resolvePlacesKey(request: Request): ResolvedPlacesKey | null {
    const userKey = request.headers.get("X-User-Google-Key")?.trim();
    if (userKey && userKey.length >= MIN_KEY_LENGTH) {
        return { key: userKey, source: "user" };
    }
    const envKey = (process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)?.trim();
    if (envKey && envKey.length >= MIN_KEY_LENGTH) {
        return { key: envKey, source: "env" };
    }
    return null;
}

function textOf(value: unknown): string | null {
    const text = (value as { text?: unknown } | null | undefined)?.text;
    return typeof text === "string" ? text : null;
}

function stringList(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
}

function numeric(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Translate Places (New) low/high bounds into the legacy northeast/southwest shape. */
export function toLegacyViewport(value: unknown): LegacyViewport | null {
    const viewport = value as { low?: unknown; high?: unknown } | null | undefined;
    const low = viewport?.low as { latitude?: unknown; longitude?: unknown } | undefined;
    const high = viewport?.high as { latitude?: unknown; longitude?: unknown } | undefined;
    const south = numeric(low?.latitude);
    const west = numeric(low?.longitude);
    const north = numeric(high?.latitude);
    const east = numeric(high?.longitude);
    if (south === null || west === null || north === null || east === null) {
        return null;
    }
    return {
        northeast: { lat: north, lng: east },
        southwest: { lat: south, lng: west },
    };
}

interface GoogleErrorBody {
    error?: { code?: number; message?: string; status?: string };
}

/** True when the failure is this request's own deadline firing, not an upstream fault. */
function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
}

/** The single mapping from a transport failure to the caller-visible error. */
function transportError(error: unknown): PlacesError {
    return isAbortError(error)
        ? new PlacesError(504, "DEADLINE_EXCEEDED", "Google Places did not respond in time.")
        : new PlacesError(502, "NETWORK_ERROR", "Could not reach Google Places.");
}

async function requestJson(
    url: string,
    key: string,
    init: { method: "GET" | "POST"; body?: string; fieldMask?: string }
): Promise<unknown> {
    const controller = new AbortController();
    // The deadline must outlive fetch(). Google can answer with headers and then
    // stall while the body is read, and a timer cleared as soon as the headers
    // arrive leaves that read unbounded.
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const headers: Record<string, string> = { "X-Goog-Api-Key": key };
        if (init.fieldMask) headers["X-Goog-FieldMask"] = init.fieldMask;
        if (init.body) headers["Content-Type"] = "application/json";

        let response: Response;
        try {
            response = await fetch(url, {
                method: init.method,
                headers,
                body: init.body,
                signal: controller.signal,
            });
        } catch (error) {
            throw transportError(error);
        }

        let payload: GoogleErrorBody | null = null;
        let bodyReadable = true;
        try {
            payload = (await response.json()) as GoogleErrorBody;
        } catch (error) {
            // A body read killed by the deadline is still a timeout, not a
            // malformed response.
            if (isAbortError(error)) throw transportError(error);
            bodyReadable = false;
        }

        if (!response.ok) {
            throw new PlacesError(
                response.status,
                payload?.error?.status ?? "HTTP_" + response.status,
                payload?.error?.message ?? "Google Places returned HTTP " + response.status + "."
            );
        }
        if (!bodyReadable) {
            // A 200 with an unreadable body is an upstream fault. Reporting it as
            // an empty result would present a broken response as "no matches".
            throw new PlacesError(
                502,
                "INVALID_RESPONSE",
                "Google Places returned an unreadable response."
            );
        }
        return payload;
    } finally {
        clearTimeout(timer);
    }
}

/** Autocomplete predictions. Query-level suggestions are dropped: they carry no place id. */
export async function autocompletePlaces(input: string, key: string): Promise<PlacePrediction[]> {
    const payload = (await requestJson(AUTOCOMPLETE_URL, key, {
        method: "POST",
        body: JSON.stringify({ input }),
        fieldMask: AUTOCOMPLETE_FIELD_MASK,
    })) as { suggestions?: unknown };
    if (!Array.isArray(payload?.suggestions)) {
        return [];
    }
    return payload.suggestions.flatMap((suggestion) => {
        const prediction = (suggestion as { placePrediction?: Record<string, unknown> } | null)
            ?.placePrediction;
        const placeId = prediction?.placeId;
        if (typeof placeId !== "string" || placeId.length === 0) {
            return [];
        }
        const description = textOf(prediction?.text) ?? "";
        const structured = prediction?.structuredFormat as
            | { mainText?: unknown; secondaryText?: unknown }
            | undefined;
        return [
            {
                placeId,
                description,
                mainText: textOf(structured?.mainText) ?? description,
                secondaryText: textOf(structured?.secondaryText) ?? "",
                types: stringList(prediction?.types),
            },
        ];
    });
}

/** Resolve one place to coordinates, name and legacy viewport bounds. */
export async function fetchPlaceDetails(placeId: string, key: string): Promise<PlaceDetails> {
    const payload = (await requestJson(PLACE_DETAILS_URL + encodeURIComponent(placeId), key, {
        method: "GET",
        fieldMask: DETAILS_FIELD_MASK,
    })) as {
        location?: { latitude?: unknown; longitude?: unknown };
        displayName?: unknown;
        types?: unknown;
        viewport?: unknown;
    };
    const lat = numeric(payload?.location?.latitude);
    const lon = numeric(payload?.location?.longitude);
    if (lat === null || lon === null) {
        throw new PlacesError(404, "NO_GEOMETRY", "Google Places returned no coordinates for this place.");
    }
    return {
        lat,
        lon,
        name: textOf(payload?.displayName) ?? "",
        types: stringList(payload?.types),
        viewport: toLegacyViewport(payload?.viewport),
    };
}

/** Free-text place search, used by the search_places MCP tool. */
export async function textSearchPlaces(
    query: string,
    key: string,
    maxResultCount: number = DEFAULT_SEARCH_RESULTS
): Promise<PlaceSearchResult[]> {
    const capped = Math.min(Math.max(Math.trunc(maxResultCount) || DEFAULT_SEARCH_RESULTS, 1), MAX_SEARCH_RESULTS);
    const payload = (await requestJson(SEARCH_TEXT_URL, key, {
        method: "POST",
        body: JSON.stringify({ textQuery: query, maxResultCount: capped }),
        fieldMask: SEARCH_TEXT_FIELD_MASK,
    })) as { places?: unknown };
    if (!Array.isArray(payload?.places)) {
        return [];
    }
    return payload.places.flatMap((entry) => {
        const place = entry as {
            id?: unknown;
            displayName?: unknown;
            formattedAddress?: unknown;
            location?: { latitude?: unknown; longitude?: unknown };
            types?: unknown;
        };
        const placeId = typeof place?.id === "string" ? place.id : null;
        const lat = numeric(place?.location?.latitude);
        const lon = numeric(place?.location?.longitude);
        if (!placeId || lat === null || lon === null) {
            return [];
        }
        return [
            {
                placeId,
                name: textOf(place.displayName) ?? "",
                address: typeof place.formattedAddress === "string" ? place.formattedAddress : "",
                lat,
                lon,
                types: stringList(place.types),
            },
        ];
    });
}

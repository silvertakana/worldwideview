import { MapPin } from "lucide-react";
import { buildUserKeyHeaders } from "@/lib/userApiKeys";
import { categorizePlace, type PlaceCategory } from "./placeCategories";
import type { SearchResult, SearchSection } from "./searchTypes";

/** Mirrors the API's own wording for a missing instance key, so the two never drift apart. */
export const PLACES_NOT_CONFIGURED =
    "Google place search is not configured on this instance.";

export const PLACES_UNREACHABLE = "Could not reach the Google place search service.";

export interface LocationSearchOutcome {
    /** The Places section, or null when there is nothing to show. */
    section: SearchSection | null;
    /** User-facing reason the lookup failed, or null on success. */
    error: string | null;
    /** True when retrying the same query could succeed. */
    retryable: boolean;
}

interface PlacesErrorBody {
    error?: unknown;
    code?: unknown;
}

function errorMessageOf(body: PlacesErrorBody | null): string | null {
    return typeof body?.error === "string" && body.error.trim() ? body.error : null;
}

/**
 * Turn a failed /api/places/search response into text a user can act on. The route's own
 * message wins whenever it has one: it carries Google's wording for an upstream refusal.
 */
function describePlacesFailure(status: number, body: PlacesErrorBody | null, fallback: string): string {
    return errorMessageOf(body) ?? (status === 503 ? PLACES_NOT_CONFIGURED : fallback);
}

/**
 * Query Google Places autocomplete through the globe's own route. The previous shape returned
 * a bare null on every failure, which the dropdown then rendered as "No results found." - the
 * user could not tell an empty result set from an unconfigured or refusing backend.
 */
export async function searchLocations(query: string): Promise<LocationSearchOutcome> {
    let res: Response;
    try {
        res = await fetch(`/api/places/search?input=${encodeURIComponent(query)}`, {
            headers: buildUserKeyHeaders(),
        });
    } catch (err) {
        console.error("Error fetching places:", err);
        return { section: null, error: PLACES_UNREACHABLE, retryable: true };
    }

    if (!res.ok) {
        const body = (await res.json().catch(() => null)) as PlacesErrorBody | null;
        const message = describePlacesFailure(res.status, body, "Place search failed.");
        console.error("Places search failed:", res.status, body?.code ?? "", message);
        return { section: null, error: message, retryable: res.status >= 500 };
    }

    const data = (await res.json().catch(() => null)) as { predictions?: unknown } | null;
    const predictions = Array.isArray(data?.predictions) ? data.predictions : [];
    if (predictions.length === 0) return { section: null, error: null, retryable: false };

    const results: SearchResult[] = predictions.map(
        (p: { placeId: string; mainText: string; secondaryText: string; types?: string[] }, i: number) => {
            const category = categorizePlace(p.types || []);
            return {
                id: p.placeId,
                label: p.mainText,
                subLabel: p.secondaryText,
                score: 100 - i,
                lat: 0,
                lon: 0,
                type: category === "region" ? "country" as const : "place" as const,
                placeCategory: category,
            };
        }
    );

    return {
        section: {
            title: "Places",
            icon: <MapPin size={16} />,
            results: results.slice(0, 5),
            maxScore: results[0].score,
        },
        error: null,
        retryable: false,
    };
}
